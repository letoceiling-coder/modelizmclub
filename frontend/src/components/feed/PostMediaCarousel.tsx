import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { Img } from "@/components/ui/Img";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import { displaySrc, variantUrl, type MediaVariantSet } from "@/lib/media/variants";
import { Lightbox } from "@/components/post/Lightbox";

export type MediaCarouselItem = {
  type: "image" | "video";
  url: string;
  /** Backend size ladder. Without it the slide falls back to the original. */
  variants?: MediaVariantSet | null;
  /** Intrinsic size when the API knows it — reserves the box before the bytes arrive. */
  width?: number;
  height?: number;
};

/** Fallback intrinsic size for images whose dimensions the API did not send (4:3). */
const FALLBACK_W = 1200;
const FALLBACK_H = 900;

/** Portrait 4:5 … landscape 16:9 — keeps feed layout predictable. */
const MIN_ASPECT = 4 / 5;
const MAX_ASPECT = 16 / 9;
const DEFAULT_IMAGE_ASPECT = 1;
const VIDEO_ASPECT = 16 / 9;

const aspectCache = new Map<string, number>();

function clampAspect(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return DEFAULT_IMAGE_ASPECT;
  return Math.min(MAX_ASPECT, Math.max(MIN_ASPECT, ratio));
}

function useNaturalAspectRatio(url: string | null | undefined): number | null {
  const [aspect, setAspect] = useState<number | null>(() =>
    url ? (aspectCache.get(url) ?? null) : null,
  );

  useEffect(() => {
    if (!url) {
      setAspect(null);
      return;
    }
    const cached = aspectCache.get(url);
    if (cached != null) {
      setAspect(cached);
      return;
    }
    let active = true;
    const img = new Image();
    img.onload = () => {
      if (!active || !img.naturalWidth || !img.naturalHeight) return;
      const ratio = clampAspect(img.naturalWidth / img.naturalHeight);
      aspectCache.set(url, ratio);
      setAspect(ratio);
    };
    img.onerror = () => {
      if (active) setAspect(null);
    };
    img.src = url;
    return () => {
      active = false;
    };
  }, [url]);

  return aspect;
}

function useSlideAspect(item: MediaCarouselItem): number {
  // Measuring the ratio by loading the picture used to download the original —
  // 2.8 MB fetched purely to read naturalWidth, on top of the card variant the
  // slide actually shows. The API usually sends width and height, and when it
  // does not, thumb answers the same question for twenty kilobytes.
  const needsProbe = item.type === "image" && !(item.width && item.height);
  const probeAspect = useNaturalAspectRatio(needsProbe ? variantUrl(item.url, "thumb") : null);
  const imageAspect =
    item.type === "image" && item.width && item.height
      ? clampAspect(item.width / item.height)
      : probeAspect;
  if (item.type === "video") return VIDEO_ASPECT;
  return imageAspect ?? DEFAULT_IMAGE_ASPECT;
}

function GalleryImage({
  src,
  variants,
  alt,
  onClick,
  contain = true,
  width = FALLBACK_W,
  height = FALLBACK_H,
  priority = false,
}: {
  src: string;
  variants?: MediaVariantSet | null;
  alt: string;
  onClick?: () => void;
  contain?: boolean;
  width?: number;
  height?: number;
  priority?: boolean;
}) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div
        className="flex h-full w-full items-center justify-center gap-[8px]"
        style={{ background: "var(--background-surface)", color: "var(--foreground-30)" }}
        aria-label="Изображение недоступно"
      >
        <ImageOff className="h-[20px] w-[20px]" />
        <span className="text-[12px]">Фото недоступно</span>
      </div>
    );
  }
  return (
    <ResponsiveImage
      media={{ url: src, variants }}
      alt={alt}
      variants={["card", "medium"]}
      sizes="(max-width: 768px) 100vw, 680px"
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      onClick={onClick}
      className={`h-full w-full ${contain ? "object-contain" : "cursor-zoom-in object-cover"} ${onClick ? "cursor-zoom-in" : ""}`}
      onError={() => setErr(true)}
    />
  );
}

function CarouselVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);

  const videoPreload = useVideoPreload();

  useEffect(() => {
    return () => {
      ref.current?.pause();
    };
  }, []);

  return (
    <video
      ref={ref}
      src={src}
      controls
      preload={videoPreload}
      playsInline
      className="h-full w-full object-contain"
    />
  );
}

/**
 * Когда видео можно разрешить тянуть метаданные.
 *
 * `preload="metadata"` у видео ленты снимал с прода 148 КБ диапазонными
 * запросами прямо во время первой загрузки — рядом с картинкой баннера,
 * которая и есть LCP-элемент страницы. На медленном канале эти килобайты
 * отодвигали LCP: замерено Lighthouse, картинка 49 КБ приходила на 1325 мс,
 * видео 148 КБ — на 1406 мс, в одном и том же окне.
 *
 * Первый кадр всё равно нужен — без него на месте видео чёрный
 * прямоугольник, — поэтому метаданные не отменяются, а откладываются до
 * события load: к этому моменту LCP уже отрисован.
 */
function useVideoPreload(): "none" | "metadata" {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (document.readyState === "complete") {
      setReady(true);
      return;
    }
    const on = () => setReady(true);
    window.addEventListener("load", on, { once: true });
    return () => window.removeEventListener("load", on);
  }, []);
  return ready ? "metadata" : "none";
}

function MediaFrame({
  aspect,
  className = "",
  children,
}: {
  aspect: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={`w-full overflow-hidden transition-[aspect-ratio] duration-200 ease-out ${className}`}
      style={{ aspectRatio: aspect }}
    >
      {children}
    </div>
  );
}

function SingleMedia({
  item,
  alt,
  onImageClick,
  priority = false,
}: {
  item: MediaCarouselItem;
  alt: string;
  onImageClick?: () => void;
  priority?: boolean;
}) {
  const aspect = useSlideAspect(item);

  if (item.type === "video") {
    return (
      <MediaFrame aspect={aspect} className="bg-black">
        <CarouselVideo src={item.url} />
      </MediaFrame>
    );
  }

  return (
    <MediaFrame aspect={aspect} className="bg-[var(--background-surface)]">
      <GalleryImage
        src={item.url}
        alt={alt}
        width={item.width}
        height={item.height}
        priority={priority}
        onClick={onImageClick}
      />
    </MediaFrame>
  );
}

/** Mixed image/video carousel for feed and channel posts. */
export function PostMediaCarousel({
  items,
  alt,
  priority = false,
}: {
  items: MediaCarouselItem[];
  alt: string;
  priority?: boolean;
}) {
  const [viewportRef, embla] = useEmblaCarousel({ loop: items.length > 1 });
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());
  const videoPreload = useVideoPreload();

  const imageUrls = items
    .filter((item) => item.type === "image")
    .map((item) => displaySrc({ url: item.url, variants: item.variants ?? undefined }, "large"));
  let imageCounter = 0;
  const imageIndexBySlide = items.map((item) => (item.type === "image" ? imageCounter++ : -1));

  const currentAspect = useSlideAspect(items[selected] ?? items[0]);

  const onSelect = useCallback(() => {
    if (!embla) return;
    const next = embla.selectedScrollSnap();
    setSelected(next);
    videoRefs.current.forEach((video, index) => {
      if (index !== next) video.pause();
    });
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    onSelect();
    embla.on("select", onSelect);
    embla.on("reInit", onSelect);
    return () => {
      embla.off("select", onSelect);
      embla.off("reInit", onSelect);
    };
  }, [embla, onSelect]);

  useEffect(() => {
    embla?.reInit();
  }, [embla, currentAspect]);

  if (items.length === 0) return null;

  if (items.length === 1) {
    const item = items[0];
    return (
      <>
        <SingleMedia
          item={item}
          alt={alt}
          priority={priority}
          onImageClick={item.type === "image" ? () => setLightbox(0) : undefined}
        />
        {lightbox !== null && item.type === "image" && (
          <Lightbox
            images={[item.url]}
            startIndex={0}
            alt={alt}
            onClose={() => setLightbox(null)}
          />
        )}
      </>
    );
  }

  return (
    <div className="relative">
      <MediaFrame aspect={currentAspect} className="bg-black">
        <div className="h-full overflow-hidden" ref={viewportRef}>
          <div className="flex h-full">
            {items.map((item, i) => (
              <div key={`${item.type}-${item.url}-${i}`} className="h-full min-w-0 flex-[0_0_100%]">
                {item.type === "video" ? (
                  <video
                    ref={(el) => {
                      if (el) videoRefs.current.set(i, el);
                      else videoRefs.current.delete(i);
                    }}
                    src={item.url}
                    controls
                    preload={videoPreload}
                    playsInline
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <GalleryImage
                    src={item.url}
                    alt={`${alt} — фото ${i + 1}`}
                    width={item.width}
                    height={item.height}
                    priority={priority && i === 0}
                    onClick={() => {
                      const idx = imageIndexBySlide[i];
                      if (idx >= 0) setLightbox(idx);
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </div>
      </MediaFrame>

      <div
        className="pointer-events-none absolute right-[10px] top-[10px] rounded-full px-[9px] py-[3px] text-[11px] font-medium text-white"
        style={{ background: "rgba(0,0,0,0.55)" }}
      >
        {selected + 1}/{items.length}
      </div>

      <button
        type="button"
        onClick={() => embla?.scrollPrev()}
        aria-label="Предыдущий слайд"
        className="absolute left-[8px] top-1/2 hidden -translate-y-1/2 place-items-center rounded-full text-white sm:grid h-[32px] w-[32px]"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
      >
        <ChevronLeft className="h-[16px] w-[16px]" />
      </button>
      <button
        type="button"
        onClick={() => embla?.scrollNext()}
        aria-label="Следующий слайд"
        className="absolute right-[8px] top-1/2 hidden -translate-y-1/2 place-items-center rounded-full text-white sm:grid h-[32px] w-[32px]"
        style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
      >
        <ChevronRight className="h-[16px] w-[16px]" />
      </button>

      <div className="absolute inset-x-0 bottom-[8px] flex items-center justify-center gap-[6px]">
        {items.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Слайд ${i + 1}`}
            onClick={() => embla?.scrollTo(i)}
            className="rounded-full transition-all"
            style={{
              width: i === selected ? 18 : 6,
              height: 6,
              background: i === selected ? "#fff" : "rgba(255,255,255,0.55)",
            }}
          />
        ))}
      </div>

      {lightbox !== null && imageUrls.length > 0 && (
        <Lightbox
          images={imageUrls}
          startIndex={lightbox}
          alt={alt}
          onClose={() => setLightbox(null)}
        />
      )}
    </div>
  );
}
