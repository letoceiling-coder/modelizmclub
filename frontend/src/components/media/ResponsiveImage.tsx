import { useEffect, useRef, useState } from "react";
import { Img } from "@/components/ui/Img";
import { pictureSrcSet, type DisplayMedia } from "@/lib/media/variants";

type VariantName = "thumb" | "card" | "medium" | "large";

interface Props {
  media: DisplayMedia;
  alt: string;
  variants: VariantName[];
  /**
   * How wide the image is painted at each breakpoint, so the browser can pick
   * the right entry of the srcset before layout. Match the CSS: `96px` for a
   * fixed thumbnail, `(max-width: 640px) 50vw, 280px` for a card in a grid.
   */
  sizes: string;
  /**
   * Intrinsic size — required, same contract as `Img`. Reserves the box before
   * the bytes arrive; CSS (object-cover, h-full) still decides the painting.
   */
  width: number;
  height: number;
  className?: string;
  loading?: "lazy" | "eager";
  /** LCP candidate: pair with loading="eager". */
  fetchPriority?: "high" | "low" | "auto";
  decoding?: "async" | "auto" | "sync";
  /**
   * Не запрашивать байты, пока картинка не подойдёт к экрану.
   *
   * `loading="lazy"` для этого недостаточно: порог у Chrome измеряется
   * тысячами пикселей и зависит от скорости соединения. Замер ленты 12.09 при
   * 1,6 Мбит/с: семь картинок ниже сгиба — от 8 до 850 px под ним — ушли в
   * сеть до всякой прокрутки и разделили канал с кандидатом LCP.
   *
   * Здесь до пересечения не рисуется ни `src`, ни `srcset`: вместо `<picture>`
   * стоит пустая коробка тех же размеров. Серверная разметка и первый кадр
   * гидрации совпадают — на сервере наблюдателя нет, и обе стороны одинаково
   * считают картинку ещё не нужной.
   */
  defer?: boolean;
  draggable?: boolean;
  onError?: () => void;
  onClick?: () => void;
}

/**
 * The one place that turns a `DisplayMedia` into a `<picture>`: AVIF, then
 * WebP, then JPEG, each with a width-descriptor srcset over the backend's
 * thumb/card/medium/large variants. The `<img>` itself is an `Img`, so the
 * width/height contract is identical whether or not variants exist.
 */
export function ResponsiveImage({
  media,
  alt,
  variants,
  sizes,
  width,
  height,
  className,
  loading = "lazy",
  fetchPriority,
  decoding = "async",
  defer = false,
  draggable,
  onError,
  onClick,
}: Props) {
  const [failed, setFailed] = useState(false);
  /*
   * `near` начинается с `!defer` — тогда отложенная картинка на сервере и в
   * первом клиентском кадре одинаково пуста, и гидрация не расходится.
   */
  const [near, setNear] = useState(!defer);
  const box = useRef<HTMLSpanElement | null>(null);

  useEffect(() => {
    if (near) return;
    const el = box.current;
    if (!el) return;
    if (typeof IntersectionObserver === "undefined") {
      // Браузер без наблюдателя ничего не откладывает — это лучше пустого места.
      setNear(true);
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        if (!entries.some((e) => e.isIntersecting)) return;
        setNear(true);
        io.disconnect();
      },
      // Запас в пол-экрана: байты успевают приехать до того, как плитка видна.
      { rootMargin: "400px 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [near]);

  if (!near) {
    return <span ref={box} className={className} style={{ display: "block" }} aria-hidden="true" />;
  }

  const picture = pictureSrcSet(media, variants);
  const src = failed ? media.url : picture.src;

  const handleError = () => {
    if (!failed && src !== media.url) {
      setFailed(true);
      return;
    }
    onError?.();
  };

  const img = (
    <Img
      src={src}
      alt={alt}
      className={className}
      loading={loading}
      fetchPriority={fetchPriority}
      decoding={decoding}
      draggable={draggable}
      width={width}
      height={height}
      onError={handleError}
      onClick={onClick}
    />
  );

  if (failed || picture.sources.length === 0) {
    return img;
  }

  return (
    <picture>
      {picture.sources.map((source) => (
        <source key={source.format} type={source.type} srcSet={source.srcSet} sizes={sizes} />
      ))}
      {img}
    </picture>
  );
}
