import { useCallback, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

interface Props {
  images: string[];
  startIndex?: number;
  alt?: string;
  onClose: () => void;
}

const CONTROL = "absolute z-[2] grid place-items-center rounded-full text-white";
const CONTROL_BG = { background: "rgba(255,255,255,0.14)" } as const;

/**
 * The one full-screen image viewer. Portaled to document.body so no animated
 * ancestor clips it. Closes on Escape, the backdrop, or the ✕; arrows and
 * ←/→ move between images; on touch the strip itself swipes (embla).
 */
export function Lightbox({ images, startIndex = 0, alt = "", onClose }: Props) {
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

  if (typeof document === "undefined" || images.length === 0) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: "rgba(0,0,0,0.92)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={alt || "Просмотр фото"}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Закрыть"
        className={`${CONTROL} h-[44px] w-[44px]`}
        style={{ ...CONTROL_BG, top: "max(12px, env(safe-area-inset-top))", right: "max(12px, env(safe-area-inset-right))" }}
      >
        <X className="h-[20px] w-[20px]" />
      </button>

      {images.length > 1 && (
        <div
          className="absolute left-1/2 z-[2] -translate-x-1/2 rounded-full px-[12px] py-[5px] text-[13px] font-medium text-white"
          style={{ background: "rgba(0,0,0,0.5)", top: "max(20px, env(safe-area-inset-top))" }}
        >
          {selected + 1} / {images.length}
        </div>
      )}

      <div className="h-full w-full overflow-hidden" ref={viewportRef} onClick={(e) => e.stopPropagation()}>
        <div className="flex h-full">
          {images.map((src, i) => (
            <div key={`${src}-${i}`} className="flex h-full min-w-0 flex-[0_0_100%] items-center justify-center p-[16px]">
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
    </div>,
    document.body,
  );
}
