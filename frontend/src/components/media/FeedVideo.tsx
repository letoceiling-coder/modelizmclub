import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Play, Loader2, VideoOff } from "lucide-react";
import { Img } from "@/components/ui/Img";
import type { VideoDelivery } from "@/lib/media/variants";
import { ignoreFailure } from "@/lib/errors/handle";

interface Props {
  /** Первая карточка ленты: постер грузится сразу и с высоким приоритетом. */
  priority?: boolean;
  /** Исходник. Играется в полноэкранном режиме и там, где копии нет. */
  src: string;
  /** Постер и облегчённая копия от бэкенда. */
  video?: VideoDelivery;
  /** Размеры кадра, когда API их знает: резервируют коробку до байтов. */
  width?: number;
  height?: number;
  alt: string;
}

/** Пока не нажали play, за кадром не должно уходить ни одного байта. */
const PLACEHOLDER_W = 1280;
const PLACEHOLDER_H = 720;

/**
 * Видео в ленте: постер и кнопка, плеер — по нажатию.
 *
 * `<video>` в разметке — это загрузка ещё до того, как кто-то захотел
 * смотреть. Замер на проде 05.09: один ролик в ленте, 14,1 МБ исходника,
 * 140 КБ уходило в канал сразу после события load. Браузер честно тянул
 * заголовок и первые кадры «на всякий случай» — а лента открывается чаще,
 * чем в ней нажимают play.
 *
 * Поэтому здесь до нажатия нет элемента `<video>` вовсе: только картинка
 * постера и кнопка. `preload="none"` этого не решает — Safari всё равно
 * запрашивает первый диапазон, а `poster` без `<video>` не бывает.
 *
 * Наблюдатель пересечений возвращает карточку в исходное состояние, когда
 * она уезжает далеко за экран: иначе прокрученная лента держит десяток
 * плееров с буферами.
 */
export function FeedVideo({ src, video, width, height, alt, priority = false }: Props) {
  const { t } = useTranslation();
  const [active, setActive] = useState(false);
  const [failed, setFailed] = useState(false);
  const hostRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  const poster = video?.poster;
  const light = video?.sources?.[0]?.url;
  // Лента играет копию, если она есть: полный кадр остаётся для
  // полноэкранного режима, где его действительно видно.
  const feedSrc = light ?? src;

  useEffect(() => {
    if (!active) return;
    const host = hostRef.current;
    if (!host || typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) return;
        const el = videoRef.current;
        if (el) el.pause();
        setActive(false);
      },
      // Половина экрана запаса. Больше — и уехавший ролик продолжает
      // качаться: пауза буфер не останавливает, останавливает только снятие
      // элемента. Меньше — короткая прокрутка туда-обратно сбрасывала бы то,
      // что человек смотрит.
      { rootMargin: "50% 0px" },
    );

    observer.observe(host);
    return () => observer.disconnect();
  }, [active]);

  /**
   * В полноэкранном режиме — исходник.
   *
   * Момент времени переносим руками: смена src сбрасывает позицию, и без
   * этого разворот на весь экран отматывал бы ролик в начало.
   */
  useEffect(() => {
    if (!active || !light) return;

    const onChange = () => {
      const el = videoRef.current;
      if (!el) return;
      const wantOriginal = document.fullscreenElement === el;
      const target = wantOriginal ? src : light;
      if (el.currentSrc === target || el.src === target) return;

      const at = el.currentTime;
      const playing = !el.paused;
      el.src = target;
      el.currentTime = at;
      if (playing)
        void el
          .play()
          .catch(ignoreFailure("автовоспроизведение может быть запрещено настройками браузера"));
    };

    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, [active, light, src]);

  const start = useCallback(() => {
    setFailed(false);
    setActive(true);
  }, []);

  if (active) {
    return (
      <div ref={hostRef} className="h-full w-full">
        <video
          ref={videoRef}
          src={feedSrc}
          poster={poster}
          controls
          autoPlay
          playsInline
          preload="auto"
          className="h-full w-full object-contain"
          onError={() => {
            setActive(false);
            setFailed(true);
          }}
        />
      </div>
    );
  }

  return (
    <div ref={hostRef} className="relative h-full w-full">
      {poster ? (
        <Img
          src={poster}
          alt={alt}
          width={width ?? PLACEHOLDER_W}
          height={height ?? PLACEHOLDER_H}
          /* Постер первой карточки ленты — кандидат в LCP, и до 07.09 он
             грузился лениво: признак приоритета до FeedVideo не доходил.
             Замер Lighthouse на 412 px: элемент LCP — этот самый постер
             (сверху 638, высота 232), из 3,2 с LCP 703 мс уходило на
             задержку до начала загрузки. */
          priority={priority}
          className="h-full w-full object-contain"
        />
      ) : (
        <div
          className="flex h-full w-full flex-col items-center justify-center gap-[8px]"
          style={{ background: "var(--background-surface)", color: "var(--foreground-50)" }}
        >
          {video?.status === "failed" || failed ? (
            <>
              <VideoOff className="h-[20px] w-[20px]" />
              <span className="text-[12px]">{t("components.feedVideo.posterFailed")}</span>
            </>
          ) : (
            <>
              <Loader2 className="h-[20px] w-[20px] animate-spin" />
              <span className="text-[12px]">{t("components.feedVideo.posterProcessing")}</span>
            </>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={start}
        aria-label={t("components.feedVideo.play")}
        className="absolute inset-0 grid place-items-center"
      >
        <span
          className="grid h-[56px] w-[56px] place-items-center rounded-full transition-transform duration-150 hover:scale-[1.06]"
          style={{ background: "rgba(0,0,0,0.55)", backdropFilter: "blur(2px)" }}
        >
          <Play className="h-[24px] w-[24px] translate-x-[2px]" style={{ color: "white" }} />
        </span>
      </button>
    </div>
  );
}
