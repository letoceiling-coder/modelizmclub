import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";

export type MediaCarouselItem = { type: "image" | "video"; url: string };

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
  const [aspect, setAspect] = useState<number | null>(() => (url ? aspectCache.get(url) ?? null : null));

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
  const imageAspect = useNaturalAspectRatio(item.type === "image" ? item.url : null);
  if (item.type === "video") return VIDEO_ASPECT;
  return imageAspect ?? DEFAULT_IMAGE_ASPECT;
}

function GalleryImage({
  src,
  alt,
  onClick,
  contain = true,
}: {
  src: string;
  alt: string;
  onClick?: () => void;
  contain?: boolean;
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
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onClick={onClick}
      className={`h-full w-full ${contain ? "object-contain" : "cursor-zoom-in object-cover"} ${onClick ? "cursor-zoom-in" : ""}`}
      onError={() => setErr(true)}
    />
  );
}

function CarouselVideo({ src }: { src: string }) {
  const ref = useRef<HTMLVideoElement>(null);

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
      preload="metadata"
      playsInline
      className="h-full w-full object-contain"
    />
  );
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

function Lightbox({
  images,
  startIndex,
  alt,
  onClose,
}: {
  images: string[];
  startIndex: number;
  alt: string;
  onClose: () => void;
}) {
  const [viewportRef, embla] = useEmblaCarousel({ loop: images.length > 1, startIndex });
  const [selected, setSelected] = useState(startIndex);

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

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.9)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className="absolute right-[16px] top-[16px] z-[2] grid h-[40px] w-[40px] place-items-center rounded-full text-white"
        style={{ background: "rgba(255,255,255,0.14)" }}
      >
        <X className="h-[20px] w-[20px]" />
      </button>

      <div className="absolute left-1/2 top-[20px] z-[2] -translate-x-1/2 rounded-full px-[12px] py-[5px] text-[13px] font-medium text-white" style={{ background: "rgba(0,0,0,0.5)" }}>
        {selected + 1} / {images.length}
      </div>

      <div className="h-full w-full overflow-hidden" ref={viewportRef} onClick={(e) => e.stopPropagation()}>
        <div className="flex h-full">
          {images.map((src, i) => (
            <div key={i} className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center p-[16px]">
              <GalleryImage src={src} alt={`${alt} — фото ${i + 1}`} contain />
            </div>
          ))}
        </div>
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); embla?.scrollPrev(); }}
            aria-label="Предыдущее фото"
            className="absolute left-[16px] top-1/2 z-[2] grid h-[44px] w-[44px] -translate-y-1/2 place-items-center rounded-full text-white"
            style={{ background: "rgba(255,255,255,0.14)" }}
          >
            <ChevronLeft className="h-[22px] w-[22px]" />
          </button>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); embla?.scrollNext(); }}
            aria-label="Следующее фото"
            className="absolute right-[16px] top-1/2 z-[2] grid h-[44px] w-[44px] -translate-y-1/2 place-items-center rounded-full text-white"
            style={{ background: "rgba(255,255,255,0.14)" }}
          >
            <ChevronRight className="h-[22px] w-[22px]" />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}

function SingleMedia({ item, alt, onImageClick }: { item: MediaCarouselItem; alt: string; onImageClick?: () => void }) {
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
      <GalleryImage src={item.url} alt={alt} onClick={onImageClick} />
    </MediaFrame>
  );
}

/** Mixed image/video carousel for feed and channel posts. */
export function PostMediaCarousel({ items, alt }: { items: MediaCarouselItem[]; alt: string }) {
  const [viewportRef, embla] = useEmblaCarousel({ loop: items.length > 1 });
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);
  const videoRefs = useRef<Map<number, HTMLVideoElement>>(new Map());

  const imageUrls = items.filter((item) => item.type === "image").map((item) => item.url);
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
          onImageClick={item.type === "image" ? () => setLightbox(0) : undefined}
        />
        {lightbox !== null && item.type === "image" && (
          <Lightbox images={[item.url]} startIndex={0} alt={alt} onClose={() => setLightbox(null)} />
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
                    preload="metadata"
                    playsInline
                    className="h-full w-full object-contain"
                  />
                ) : (
                  <GalleryImage
                    src={item.url}
                    alt={`${alt} — фото ${i + 1}`}
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

      <div className="pointer-events-none absolute right-[10px] top-[10px] rounded-full px-[9px] py-[3px] text-[11px] font-medium text-white" style={{ background: "rgba(0,0,0,0.55)" }}>
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
        <Lightbox images={imageUrls} startIndex={lightbox} alt={alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
