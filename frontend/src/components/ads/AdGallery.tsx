import { useCallback, useEffect, useMemo, useState } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { ChevronLeft, ChevronRight, ImageOff } from "lucide-react";
import { motion } from "framer-motion";
import { ReservedOverlay } from "@/components/ads/ReservedOverlay";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import { toDisplayMedia, type DisplayMedia } from "@/lib/media/variants";

/** Square fallback tile — used for a broken/empty single image. */
function GalleryFallback() {
  return (
    <div
      className="grid w-full place-items-center"
      style={{
        aspectRatio: "4 / 3",
        background: "var(--background-surface)",
        borderRadius: "var(--r-card)",
        border: "1px solid var(--border)",
      }}
    >
      <div
        className="flex flex-col items-center gap-[6px]"
        style={{ color: "var(--foreground-30)" }}
      >
        <ImageOff size={40} />
        <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
          Нет фото
        </span>
      </div>
    </div>
  );
}

export function AdGallery({
  images,
  alt,
  reserved,
}: {
  images: Array<string | DisplayMedia>;
  alt: string;
  reserved?: boolean;
}) {
  const items = useMemo(
    () =>
      images
        .map((item) => (typeof item === "string" ? toDisplayMedia(item) : item))
        .filter((item): item is DisplayMedia => Boolean(item?.url?.trim())),
    [images],
  );

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: items.length > 1,
    align: "start",
    dragFree: false,
  });
  const [thumbRef, thumbApi] = useEmblaCarousel({ containScroll: "keepSnaps", dragFree: true });
  const [selected, setSelected] = useState(0);
  const [broken, setBroken] = useState<Record<number, boolean>>({});

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    const i = emblaApi.selectedScrollSnap();
    setSelected(i);
    thumbApi?.scrollTo(i);
  }, [emblaApi, thumbApi]);

  useEffect(() => {
    if (!emblaApi) return;
    onSelect();
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const onThumb = (i: number) => emblaApi?.scrollTo(i);

  // No usable photos → single fallback tile, no carousel chrome.
  if (items.length === 0) return <GalleryFallback />;

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
        <div
          ref={emblaRef}
          className="h-full overflow-hidden touch-pan-y"
          style={{ touchAction: "pan-y pinch-zoom" }}
        >
          <div className="flex h-full">
            {items.map((item, i) => (
              <div
                key={item.url + i}
                className="relative h-full min-w-0 flex-[0_0_100%] select-none"
              >
                {broken[i] ? (
                  <div
                    className="grid h-full w-full place-items-center"
                    style={{ color: "var(--foreground-30)" }}
                  >
                    <ImageOff size={40} />
                  </div>
                ) : (
                  <ResponsiveImage
                    media={item}
                    alt={`${alt} — фото ${i + 1}`}
                    variants={["medium", "large"]}
                    sizes="(max-width: 768px) 100vw, 900px"
                    width={1200}
                    height={900}
                    draggable={false}
                    className="h-full w-full object-cover"
                    loading={i === 0 ? "eager" : "lazy"}
                    onError={() => setBroken((b) => ({ ...b, [i]: true }))}
                  />
                )}
              </div>
            ))}
          </div>
        </div>

        {items.length > 1 && (
          <>
            <button
              type="button"
              onClick={() => emblaApi?.scrollPrev()}
              aria-label="Назад"
              className="absolute left-[12px] top-1/2 hidden h-[44px] w-[44px] -translate-y-1/2 place-items-center transition-transform hover:scale-105 md:grid"
              style={{
                background: "var(--background-elevated)",
                color: "var(--foreground)",
                borderRadius: "var(--r-pill)",
                boxShadow: "var(--shadow-float)",
              }}
            >
              <ChevronLeft size={20} />
            </button>
            <button
              type="button"
              onClick={() => emblaApi?.scrollNext()}
              aria-label="Вперёд"
              className="absolute right-[12px] top-1/2 hidden h-[44px] w-[44px] -translate-y-1/2 place-items-center transition-transform hover:scale-105 md:grid"
              style={{
                background: "var(--background-elevated)",
                color: "var(--foreground)",
                borderRadius: "var(--r-pill)",
                boxShadow: "var(--shadow-float)",
              }}
            >
              <ChevronRight size={20} />
            </button>

            <div
              className="absolute bottom-[12px] left-1/2 -translate-x-1/2 px-[10px] py-[4px] text-[11px] font-medium"
              style={{
                background: "rgba(0,0,0,0.55)",
                color: "#fff",
                borderRadius: "var(--r-pill)",
                backdropFilter: "blur(8px)",
              }}
            >
              {selected + 1} / {items.length}
            </div>
          </>
        )}

        {reserved && <ReservedOverlay />}
      </div>

      {items.length > 1 && (
        <div ref={thumbRef} className="overflow-hidden">
          <div className="flex gap-[8px]">
            {items.map((item, i) => (
              <motion.button
                key={item.url + i}
                type="button"
                onClick={() => onThumb(i)}
                whileTap={{ scale: 0.95 }}
                aria-label={`Фото ${i + 1}`}
                className="grid place-items-center overflow-hidden"
                style={{
                  flex: "0 0 88px",
                  height: 66,
                  borderRadius: "var(--r-card-sm)",
                  border: `2px solid ${selected === i ? "var(--accent)" : "transparent"}`,
                  background: "var(--background-surface)",
                  opacity: selected === i ? 1 : 0.6,
                  transition: "opacity 200ms, border-color 200ms",
                }}
              >
                {broken[i] ? (
                  <ImageOff size={18} style={{ color: "var(--foreground-30)" }} />
                ) : (
                  <ResponsiveImage
                    media={item}
                    alt=""
                    variants={["thumb"]}
                    sizes="88px"
                    width={88}
                    height={66}
                    draggable={false}
                    className="h-full w-full object-cover"
                    onError={() => setBroken((b) => ({ ...b, [i]: true }))}
                  />
                )}
              </motion.button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
