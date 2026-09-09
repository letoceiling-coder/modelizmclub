import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import useEmblaCarousel from "embla-carousel-react";
import { useTranslation } from "react-i18next";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  /**
   * Фотографии записи. Пустой список — законное состояние: запись без медиа
   * тоже открывается в просмотрщике, только без левой колонки.
   */
  images: string[];
  startIndex?: number;
  alt?: string;
  onClose: () => void;
  /**
   * Панель записи: автор, дата, действия, текст и комментарии.
   *
   * От 1024 стоит справа колонкой в 380. Ниже — снизу, нижней частью окна:
   * рядом с фотографией она не помещается (замер на 768: окно 720, панель
   * забирает 380 и оставляет снимку 340 — он оказывается уже панели), а
   * отдельным окном разговор уезжает от записи, к которой относится.
   */
  aside?: ReactNode;
}

/**
 * «Закрыть» для содержимого панели.
 *
 * Панель собирает карточка, а закрытием владеет просмотрщик, и между ними
 * лежат три чужих компонента: PostMedia, PostMediaCarousel, FeedMediaGrid.
 * Протаскивать колбэк через их пропсы значило бы менять сигнатуры четырёх
 * файлов ради одной кнопки; контекст доносит его напрямую.
 */
const LightboxCloseContext = createContext<(() => void) | null>(null);

/**
 * Крестик 32×32 в шапке панели. Живёт здесь, а не в карточке: это хром
 * просмотрщика, и он же единственный, кому нужен контекст выше.
 */
export function LightboxCloseButton() {
  const { t } = useTranslation();
  const close = useContext(LightboxCloseContext);
  if (!close) return null;
  return (
    <button
      type="button"
      onClick={close}
      aria-label={t("common.close")}
      className="hit-target grid h-[32px] w-[32px] shrink-0 cursor-pointer place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]"
      style={{ color: "var(--foreground-70)" }}
    >
      <X className="h-[20px] w-[20px]" />
    </button>
  );
}

const CONTROL = "absolute z-[2] grid place-items-center rounded-full text-white";
const CONTROL_BG = { background: "rgba(255,255,255,0.14)" } as const;

/**
 * The one full-screen image viewer. Portaled to document.body so no animated
 * ancestor clips it. Closes on Escape, the backdrop, or the ✕; arrows and
 * ←/→ move between images; on touch the strip itself swipes (embla).
 */
export function Lightbox({ images, startIndex = 0, alt = "", onClose, aside }: Props) {
  const [viewportRef, embla] = useEmblaCarousel({ loop: images.length > 1, startIndex });
  const [selected, setSelected] = useState(startIndex);
  // Vertical drag-to-dismiss. Embla owns the horizontal axis (swiping between
  // photos), so this only reacts once the gesture is clearly vertical, and it
  // follows the finger so the dismiss is visible before it commits.
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  const [dragY, setDragY] = useState(0);

  const onPointerDown = (e: React.PointerEvent) => {
    if (e.pointerType === "mouse") return;
    drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
  };

  const onPointerMove = (e: React.PointerEvent) => {
    const start = drag.current;
    if (!start || start.id !== e.pointerId) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dy) < Math.abs(dx)) return;
    setDragY(dy);
  };

  const endDrag = () => {
    if (!drag.current) return;
    drag.current = null;
    if (Math.abs(dragY) > 90) {
      setDragY(0);
      onClose();
      return;
    }
    setDragY(0);
  };

  const onSelect = useCallback(() => {
    if (embla) setSelected(embla.selectedScrollSnap());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    onSelect();
    embla.on("select", onSelect);
    return () => {
      embla.off("select", onSelect);
    };
  }, [embla, onSelect]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") embla?.scrollPrev();
      else if (e.key === "ArrowRight") embla?.scrollNext();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [embla, onClose]);

  if (typeof document === "undefined") return null;
  // Ни фотографий, ни панели — показывать нечего.
  if (images.length === 0 && !aside) return null;

  // Запись без медиа: левой колонки нет, и окно сужается до одной панели.
  // Оставить его в 1200 значило бы растянуть колонку комментариев вдвое от
  // той ширины, под которую она набрана.
  const mediaOnly = images.length > 0;

  return createPortal(
    <div
      className="fixed inset-0 z-[var(--z-overlay)] flex items-center justify-center lg:p-6"
      style={{ background: "rgba(0,0,0,0.7)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Просмотр фото"}
    >
      {/*
        Окно, а не весь экран.
        Затемнение лежит на слое overlay, окно — на modal: так у них разные
        слои, как в шкале, и клик по затемнению остаётся кликом «мимо».
        Ниже 1024 окно во весь экран и складывается в столбец: медиа сверху,
        панель снизу. Рядом друг с другом они там не помещаются.
      */}
      <div
        className={`z-[var(--z-modal)] flex h-full w-full flex-col overflow-hidden lg:h-[88vh] lg:flex-row lg:rounded-[var(--r-card)] ${
          mediaOnly ? "lg:max-w-[1200px]" : "lg:max-w-[640px]"
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Колонка с фотографией. Управление лежит внутри неё, а не в корне:
          иначе крестик и стрелка «вперёд» оказались бы поверх правой панели. */}
        {mediaOnly && (
          <div
            /*
              На узком экране медиа занимает треть высоты, остальное —
              панель. Замер на 375×812: при 38vh под список комментариев
              оставалось 160 px, то есть две реплики; при 32vh — 209.
              Делить пополам нельзя вовсе: шапка, действия, текст и
              сортировка съедают панель раньше, чем очередь доходит до
              самих комментариев, ради которых окно и открывали.
            */
            className={`relative flex min-h-0 min-w-0 items-center justify-center ${
              aside ? "max-h-[32vh] flex-1 lg:max-h-none" : "flex-1"
            }`}
            style={{ background: "rgba(0,0,0,0.92)" }}
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              /*
            Когда панель есть, крестик живёт в её шапке — там же, где он у VK,
            и на любой ширине: панель показывается и на узком экране, снизу.
            Второй крестик поверх фотографии был бы дублем. Без панели этот
            остаётся единственным.
          */
              className={`${CONTROL} h-[44px] w-[44px] ${aside ? "hidden" : ""}`}
              style={{
                ...CONTROL_BG,
                top: "max(12px, env(safe-area-inset-top))",
                right: "max(12px, env(safe-area-inset-right))",
              }}
            >
              <X className="h-[20px] w-[20px]" />
            </button>

            {images.length > 1 && (
              <div
                className="absolute left-1/2 z-[2] -translate-x-1/2 rounded-full px-[12px] py-[5px] text-[13px] font-medium text-white"
                style={{
                  background: "rgba(0,0,0,0.5)",
                  top: "max(20px, env(safe-area-inset-top))",
                }}
              >
                {selected + 1} / {images.length}
              </div>
            )}

            {/* The strip fills the screen, so a click only counts as "outside" when
          it lands on the padding around a photo rather than on the photo. */}
            <div
              className="h-full w-full touch-pan-x overflow-hidden"
              ref={viewportRef}
              onClick={(e) => {
                if (e.target instanceof HTMLImageElement) e.stopPropagation();
              }}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{
                transform: dragY ? `translateY(${dragY}px)` : undefined,
                opacity: dragY ? Math.max(0.35, 1 - Math.abs(dragY) / 400) : 1,
                transition: dragY ? "none" : "transform 0.18s ease, opacity 0.18s ease",
              }}
            >
              <div className="flex h-full">
                {images.map((src, i) => (
                  <div
                    key={`${src}-${i}`}
                    className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center p-[16px]"
                  >
                    <img
                      src={src}
                      width={1600}
                      height={1200}
                      loading={i === startIndex ? "eager" : "lazy"}
                      decoding="async"
                      alt={images.length > 1 ? `${alt} — фото ${i + 1}` : alt}
                      className="max-h-full max-w-full object-contain"
                      style={{ borderRadius: 4 }}
                      draggable={false}
                    />
                  </div>
                ))}
              </div>
            </div>

            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    embla?.scrollPrev();
                  }}
                  aria-label="Предыдущее фото"
                  className={`${CONTROL} left-[12px] top-1/2 h-[44px] w-[44px] -translate-y-1/2`}
                  style={CONTROL_BG}
                >
                  <ChevronLeft className="h-[22px] w-[22px]" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    embla?.scrollNext();
                  }}
                  aria-label="Следующее фото"
                  className={`${CONTROL} right-[12px] top-1/2 h-[44px] w-[44px] -translate-y-1/2`}
                  style={CONTROL_BG}
                >
                  <ChevronRight className="h-[22px] w-[22px]" />
                </button>
              </>
            )}
          </div>
        )}

        {aside && (
          <aside
            /*
              Ниже 1024 панель — нижняя часть окна: 55vh при медиа и вся
              высота без него. От 1024 — колонка сбоку.
            */
            className={`flex min-h-0 flex-1 flex-col lg:flex-none ${
              mediaOnly ? "lg:w-[380px]" : "lg:w-[640px]"
            }`}
            style={{
              background: "var(--background)",
              borderTop: mediaOnly ? "1px solid var(--border)" : undefined,
            }}
            /* Клик по панели — это работа с записью, а не «мимо фотографии».
               Без остановки всплытия лайк или отправка комментария закрывали бы
               просмотрщик. */
            onClick={(e) => e.stopPropagation()}
          >
            <LightboxCloseContext.Provider value={onClose}>{aside}</LightboxCloseContext.Provider>
          </aside>
        )}
      </div>
    </div>,
    document.body,
  );
}
