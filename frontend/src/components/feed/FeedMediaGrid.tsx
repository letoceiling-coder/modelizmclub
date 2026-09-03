import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { ImageOff, X, ChevronLeft, ChevronRight } from "lucide-react";
import useEmblaCarousel from "embla-carousel-react";
import { getMediaAspect, rememberMediaAspect } from "@/lib/media/aspectCache";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import { displaySrc, toDisplayMedia, type DisplayMedia } from "@/lib/media/variants";

const MAX_HEIGHT_DESKTOP = 480;
const MAX_HEIGHT_MOBILE = 420;
const GRID_GAP = 2;

function useImageAspect(url: string): number | null {
  const [aspect, setAspect] = useState<number | null>(() => getMediaAspect(url) ?? null);

  useEffect(() => {
    const cached = getMediaAspect(url);
    if (cached != null) {
      setAspect(cached);
      return;
    }
    let active = true;
    const img = new Image();
    img.onload = () => {
      if (!active || !img.naturalWidth || !img.naturalHeight) return;
      const ratio = img.naturalWidth / img.naturalHeight;
      rememberMediaAspect(url, ratio);
      setAspect(ratio);
    };
    img.src = url;
    return () => { active = false; };
  }, [url]);

  return aspect;
}

function GridImage({
  media,
  alt,
  onClick,
  className = "",
  priority = false,
}: {
  media: DisplayMedia;
  alt: string;
  onClick?: () => void;
  className?: string;
  /** LCP candidate (first image of the first feed card). */
  priority?: boolean;
}) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div className={`flex h-full w-full items-center justify-center ${className}`} style={{ background: "var(--background-surface)", color: "var(--foreground-30)" }}>
        <ImageOff className="h-[18px] w-[18px]" />
      </div>
    );
  }
  return (
    <ResponsiveImage
      media={media}
      alt={alt}
      variants={["card", "medium"]}
      sizes="(max-width:768px) 100vw, 680px"
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className={`h-full w-full cursor-zoom-in object-cover ${className}`}
      onClick={onClick}
      onError={() => setErr(true)}
    />
  );
}

function Lightbox({ images, startIndex, alt, onClose }: { images: string[]; startIndex: number; alt: string; onClose: () => void }) {
  const [viewportRef, embla] = useEmblaCarousel({ loop: images.length > 1, startIndex });
  const [selected, setSelected] = useState(startIndex);

  const onSelect = useCallback(() => {
    if (embla) setSelected(embla.selectedScrollSnap());
  }, [embla]);

  useEffect(() => {
    if (!embla) return;
    onSelect();
    embla.on("select", onSelect);
    return () => { embla.off("select", onSelect); };
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
      <button type="button" onClick={onClose} aria-label="Закрыть" className="absolute right-[16px] top-[16px] z-[2] grid h-[40px] w-[40px] place-items-center rounded-full text-white" style={{ background: "rgba(255,255,255,0.14)" }}>
        <X className="h-[20px] w-[20px]" />
      </button>
      <div className="absolute left-1/2 top-[20px] z-[2] -translate-x-1/2 rounded-full px-[12px] py-[5px] text-[13px] font-medium text-white" style={{ background: "rgba(0,0,0,0.5)" }}>
        {selected + 1} / {images.length}
      </div>
      <div className="h-full w-full overflow-hidden" ref={viewportRef} onClick={(e) => e.stopPropagation()}>
        <div className="flex h-full">
          {images.map((src, i) => (
            <div key={i} className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center p-[16px]">
              <img src={src} width={1600} height={1200} loading="lazy" decoding="async" alt={`${alt} — фото ${i + 1}`} className="max-h-full max-w-full object-contain" />
            </div>
          ))}
        </div>
      </div>
      {images.length > 1 && (
        <>
          <button type="button" onClick={(e) => { e.stopPropagation(); embla?.scrollPrev(); }} aria-label="Предыдущее" className="absolute left-[16px] top-1/2 z-[2] grid h-[44px] w-[44px] -translate-y-1/2 place-items-center rounded-full text-white" style={{ background: "rgba(255,255,255,0.14)" }}>
            <ChevronLeft className="h-[22px] w-[22px]" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); embla?.scrollNext(); }} aria-label="Следующее" className="absolute right-[16px] top-1/2 z-[2] grid h-[44px] w-[44px] -translate-y-1/2 place-items-center rounded-full text-white" style={{ background: "rgba(255,255,255,0.14)" }}>
            <ChevronRight className="h-[22px] w-[22px]" />
          </button>
        </>
      )}
    </div>,
    document.body,
  );
}

function SingleImage({ media, alt, onOpen, priority = false }: { media: DisplayMedia; alt: string; onOpen: () => void; priority?: boolean }) {
  const aspect = useImageAspect(media.url) ?? 1;
  const isPortrait = aspect < 0.95;
  const isWide = aspect >= 1.6;

  const style: React.CSSProperties = isPortrait
    ? { maxHeight: MAX_HEIGHT_MOBILE, width: "100%", aspectRatio: aspect, margin: "0 auto" }
    : isWide
      ? { width: "100%", aspectRatio: aspect, maxHeight: MAX_HEIGHT_DESKTOP }
      : { width: "100%", aspectRatio: Math.min(aspect, 1.2), maxHeight: MAX_HEIGHT_DESKTOP };

  return (
    <div className="overflow-hidden rounded-[var(--r-card)] bg-[var(--background-surface)] sm:max-h-[480px]" style={style}>
      <GridImage media={media} alt={alt} onClick={onOpen} priority={priority} className="!object-contain sm:!object-cover" />
    </div>
  );
}

/** VK-style image grid for feed posts (images only). */
export function FeedMediaGrid({ images, alt, priority = false }: { images: Array<string | DisplayMedia>; alt: string; priority?: boolean }) {
  const items = images
    .map((item) => (typeof item === "string" ? toDisplayMedia(item) : item))
    .filter((item): item is DisplayMedia => Boolean(item?.url));
  const lightboxUrls = items.map((item) => displaySrc(item, "large"));
  const [lightbox, setLightbox] = useState<number | null>(null);

  if (items.length === 0) return null;

  if (items.length === 1) {
    return (
      <>
        <SingleImage media={items[0]} alt={alt} onOpen={() => setLightbox(0)} priority={priority} />
        {lightbox !== null && <Lightbox images={lightboxUrls} startIndex={lightbox} alt={alt} onClose={() => setLightbox(null)} />}
      </>
    );
  }

  if (items.length === 2) {
    return (
      <>
        <div className="grid grid-cols-2 overflow-hidden rounded-[var(--r-card)]" style={{ gap: GRID_GAP, maxHeight: MAX_HEIGHT_DESKTOP }}>
          {items.map((item, i) => (
            <div key={item.url} className="relative min-h-[140px] overflow-hidden" style={{ aspectRatio: "1" }}>
              <GridImage media={item} alt={`${alt} — ${i + 1}`} priority={priority && i === 0} onClick={() => setLightbox(i)} />
            </div>
          ))}
        </div>
        {lightbox !== null && <Lightbox images={lightboxUrls} startIndex={lightbox} alt={alt} onClose={() => setLightbox(null)} />}
      </>
    );
  }

  if (items.length === 3) {
    return (
      <>
        <div className="grid overflow-hidden rounded-[var(--r-card)]" style={{ gap: GRID_GAP, gridTemplateColumns: "2fr 1fr", gridTemplateRows: "1fr 1fr", maxHeight: MAX_HEIGHT_DESKTOP, aspectRatio: "16/9" }}>
          <div className="relative row-span-2 min-h-0 overflow-hidden">
            <GridImage media={items[0]} alt={`${alt} — 1`} priority={priority} onClick={() => setLightbox(0)} />
          </div>
          <div className="relative min-h-0 overflow-hidden">
            <GridImage media={items[1]} alt={`${alt} — 2`} onClick={() => setLightbox(1)} />
          </div>
          <div className="relative min-h-0 overflow-hidden">
            <GridImage media={items[2]} alt={`${alt} — 3`} onClick={() => setLightbox(2)} />
          </div>
        </div>
        {lightbox !== null && <Lightbox images={lightboxUrls} startIndex={lightbox} alt={alt} onClose={() => setLightbox(null)} />}
      </>
    );
  }

  const visible = items.slice(0, 4);
  const extra = items.length - 4;

  return (
    <>
      <div className="grid grid-cols-2 overflow-hidden rounded-[var(--r-card)]" style={{ gap: GRID_GAP, maxHeight: MAX_HEIGHT_DESKTOP }}>
        {visible.map((item, i) => (
          <div key={item.url} className="relative aspect-square min-h-[100px] overflow-hidden">
            <GridImage media={item} alt={`${alt} — ${i + 1}`} priority={priority && i === 0} onClick={() => setLightbox(i)} />
            {i === 3 && extra > 0 && (
              <button
                type="button"
                onClick={() => setLightbox(3)}
                className="absolute inset-0 flex items-center justify-center text-[22px] font-bold text-white"
                style={{ background: "rgba(0,0,0,0.55)" }}
                aria-label={`Ещё ${extra} фото`}
              >
                +{extra}
              </button>
            )}
          </div>
        ))}
      </div>
      {lightbox !== null && <Lightbox images={lightboxUrls} startIndex={lightbox} alt={alt} onClose={() => setLightbox(null)} />}
    </>
  );
}
