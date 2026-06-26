import { useTranslation } from "@/lib/i18n";
import { useCallback, useEffect, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

export function AdGallery({ images, alt }: { images: string[]; alt: string }) {
  const { t } = useTranslation();
  const [emblaRef, emblaApi] = useEmblaCarousel({ loop: true });
  const [thumbRef, thumbApi] = useEmblaCarousel({ containScroll: "keepSnaps", dragFree: true });
  const [selected, setSelected] = useState(0);

  const onSelect = useCallback(() => {
    if (!emblaApi || !thumbApi) return;
    const i = emblaApi.selectedScrollSnap();
    setSelected(i);
    thumbApi.scrollTo(i);
  }, [emblaApi, thumbApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
  }, [emblaApi, onSelect]);

  const onThumb = (i: number) => emblaApi?.scrollTo(i);

  return (
    <div className="flex flex-col gap-[12px]">
      <div
        className="relative overflow-hidden"
        style={{
          aspectRatio: "4 / 3",
          background: "var(--background-surface)",
          borderRadius: "var(--r-card)",
          border: "1px solid var(--border)",
        }}
      >
        <div ref={emblaRef} className="h-full overflow-hidden">
          <div className="flex h-full">
            {images.map((src, i) => (
              <div key={i} className="relative h-full min-w-0 flex-[0_0_100%]">
                <img
                  src={src}
                  alt={t("ads.photoAlt", { title: alt, n: i + 1 })}
                  width={1200}
                  height={900}
                  className="h-full w-full object-cover"
                  loading={i === 0 ? "eager" : "lazy"}
                />
              </div>
            ))}
          </div>
        </div>

        <button
          type="button"
          onClick={() => emblaApi?.scrollPrev()}
          aria-label={t("common.back")}
          className="absolute left-[12px] top-1/2 grid h-[44px] w-[44px] -translate-y-1/2 place-items-center transition-transform hover:scale-105"
          style={{ background: "var(--background-elevated)", color: "var(--foreground)", borderRadius: "var(--r-pill)", boxShadow: "var(--shadow-float)" }}
        >
          <ChevronLeft size={20} />
        </button>
        <button
          type="button"
          onClick={() => emblaApi?.scrollNext()}
          aria-label={t("common.forward")}
          className="absolute right-[12px] top-1/2 grid h-[44px] w-[44px] -translate-y-1/2 place-items-center transition-transform hover:scale-105"
          style={{ background: "var(--background-elevated)", color: "var(--foreground)", borderRadius: "var(--r-pill)", boxShadow: "var(--shadow-float)" }}
        >
          <ChevronRight size={20} />
        </button>

        <div
          className="absolute bottom-[12px] left-1/2 -translate-x-1/2 px-[10px] py-[4px] text-[11px] font-medium"
          style={{ background: "rgba(0,0,0,0.55)", color: "#fff", borderRadius: "var(--r-pill)", backdropFilter: "blur(8px)" }}
        >
          {selected + 1} / {images.length}
        </div>
      </div>

      {images.length > 1 && (
        <div ref={thumbRef} className="overflow-hidden">
          <div className="flex gap-[8px]">
            {images.map((src, i) => (
              <motion.button
                key={i}
                type="button"
                onClick={() => onThumb(i)}
                whileTap={{ scale: 0.95 }}
                className="overflow-hidden"
                style={{
                  flex: "0 0 88px",
                  height: 66,
                  borderRadius: "var(--r-card-sm)",
                  border: `2px solid ${selected === i ? "var(--accent)" : "transparent"}`,
                  opacity: selected === i ? 1 : 0.6,
                  transition: "opacity 200ms, border-color 200ms",
                }}
              >
                <img src={src} alt="" width={88} height={66} className="h-full w-full object-cover" loading="lazy" />
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
