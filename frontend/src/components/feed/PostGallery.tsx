import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ImageOff, X } from "lucide-react";

function GalleryImage({
  src,
  alt,
  onClick,
  contain = false,
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
      className={`h-full w-full ${contain ? "object-contain" : "cursor-zoom-in object-cover"}`}
      onError={() => setErr(true)}
    />
  );
}

/** Fullscreen lightbox with its own carousel (swipe + arrows + keyboard). */
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

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center" style={{ background: "rgba(0,0,0,0.9)" }} onClick={onClose}>
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
    </div>
  );
}

/** Inline post gallery: swipe/drag carousel with arrows, counter and dots.
 *  Tapping an image opens a fullscreen lightbox with all photos. */
export function PostGallery({ images, alt }: { images: string[]; alt: string }) {
  const [viewportRef, embla] = useEmblaCarousel({ loop: images.length > 1 });
  const [selected, setSelected] = useState(0);
  const [lightbox, setLightbox] = useState<number | null>(null);

  const onSelect = useCallback(() => {
    if (embla) setSelected(embla.selectedScrollSnap());
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

  return (
    <div className="relative">
      <div className="aspect-video overflow-hidden" ref={viewportRef}>
        <div className="flex h-full">
          {images.map((src, i) => (
            <div key={i} className="h-full min-w-0 flex-[0_0_100%]">
              <GalleryImage src={src} alt={`${alt} — фото ${i + 1}`} onClick={() => setLightbox(i)} />
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute right-[10px] top-[10px] rounded-full px-[9px] py-[3px] text-[11px] font-medium text-white" style={{ background: "rgba(0,0,0,0.55)" }}>
        {selected + 1}/{images.length}
      </div>

      {images.length > 1 && (
        <>
          <button
            type="button"
            onClick={() => embla?.scrollPrev()}
            aria-label="Предыдущее фото"
            className="absolute left-[8px] top-1/2 hidden -translate-y-1/2 place-items-center rounded-full text-white sm:grid h-[32px] w-[32px]"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
          >
            <ChevronLeft className="h-[16px] w-[16px]" />
          </button>
          <button
            type="button"
            onClick={() => embla?.scrollNext()}
            aria-label="Следующее фото"
            className="absolute right-[8px] top-1/2 hidden -translate-y-1/2 place-items-center rounded-full text-white sm:grid h-[32px] w-[32px]"
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
          >
            <ChevronRight className="h-[16px] w-[16px]" />
          </button>

          <div className="absolute inset-x-0 bottom-[8px] flex items-center justify-center gap-[6px]">
            {images.map((_, i) => (
              <button
                key={i}
                type="button"
                aria-label={`Фото ${i + 1}`}
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
        </>
      )}

      {lightbox !== null && (
        <Lightbox images={images} startIndex={lightbox} alt={alt} onClose={() => setLightbox(null)} />
      )}
    </div>
  );
}
