import { useCallback, useEffect, useState } from "react";
import { ImageOff } from "lucide-react";
import { getMediaAspect, rememberMediaAspect } from "@/lib/media/aspectCache";
import { ResponsiveImage } from "@/components/media/ResponsiveImage";
import { Lightbox } from "@/components/post/Lightbox";
import { displaySrc, toDisplayMedia, type DisplayMedia } from "@/lib/media/variants";

const MAX_HEIGHT_DESKTOP = 480;
const MAX_HEIGHT_MOBILE = 420;
const GRID_GAP = 2;
/** Reference width used to turn a measured aspect ratio into width/height attrs. */
const SINGLE_BASE_WIDTH = 680;

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
    return () => {
      active = false;
    };
  }, [url]);

  return aspect;
}

function GridImage({
  media,
  alt,
  onClick,
  className = "",
  priority = false,
  width = 680,
  height = 680,
}: {
  media: DisplayMedia;
  alt: string;
  onClick?: () => void;
  className?: string;
  /** LCP candidate (first image of the first feed card). */
  priority?: boolean;
  /** Intrinsic box the grid cell reserves — square by default. */
  width?: number;
  height?: number;
}) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div
        className={`flex h-full w-full items-center justify-center ${className}`}
        style={{ background: "var(--background-surface)", color: "var(--foreground-30)" }}
      >
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
      width={width}
      height={height}
      loading={priority ? "eager" : "lazy"}
      fetchPriority={priority ? "high" : undefined}
      className={`h-full w-full cursor-zoom-in object-cover ${className}`}
      onClick={onClick}
      onError={() => setErr(true)}
    />
  );
}

function SingleImage({
  media,
  alt,
  onOpen,
  priority = false,
}: {
  media: DisplayMedia;
  alt: string;
  onOpen: () => void;
  priority?: boolean;
}) {
  const aspect = useImageAspect(media.url) ?? 1;
  const isPortrait = aspect < 0.95;
  const isWide = aspect >= 1.6;

  const style: React.CSSProperties = isPortrait
    ? { maxHeight: MAX_HEIGHT_MOBILE, width: "100%", aspectRatio: aspect, margin: "0 auto" }
    : isWide
      ? { width: "100%", aspectRatio: aspect, maxHeight: MAX_HEIGHT_DESKTOP }
      : { width: "100%", aspectRatio: Math.min(aspect, 1.2), maxHeight: MAX_HEIGHT_DESKTOP };

  return (
    <div
      className="overflow-hidden rounded-[var(--r-card)] bg-[var(--background-surface)] sm:max-h-[480px]"
      style={style}
    >
      <GridImage
        media={media}
        alt={alt}
        onClick={onOpen}
        priority={priority}
        width={SINGLE_BASE_WIDTH}
        height={Math.max(1, Math.round(SINGLE_BASE_WIDTH / aspect))}
        className="!object-contain sm:!object-cover"
      />
    </div>
  );
}

/** VK-style image grid for feed posts (images only). */
export function FeedMediaGrid({
  images,
  alt,
  priority = false,
}: {
  images: Array<string | DisplayMedia>;
  alt: string;
  priority?: boolean;
}) {
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
        {lightbox !== null && (
          <Lightbox
            images={lightboxUrls}
            startIndex={lightbox}
            alt={alt}
            onClose={() => setLightbox(null)}
          />
        )}
      </>
    );
  }

  if (items.length === 2) {
    return (
      <>
        <div
          className="grid grid-cols-2 overflow-hidden rounded-[var(--r-card)]"
          style={{ gap: GRID_GAP, maxHeight: MAX_HEIGHT_DESKTOP }}
        >
          {items.map((item, i) => (
            <div
              key={item.url}
              className="relative min-h-[140px] overflow-hidden"
              style={{ aspectRatio: "1" }}
            >
              <GridImage
                media={item}
                alt={`${alt} — ${i + 1}`}
                priority={priority && i === 0}
                onClick={() => setLightbox(i)}
              />
            </div>
          ))}
        </div>
        {lightbox !== null && (
          <Lightbox
            images={lightboxUrls}
            startIndex={lightbox}
            alt={alt}
            onClose={() => setLightbox(null)}
          />
        )}
      </>
    );
  }

  if (items.length === 3) {
    return (
      <>
        <div
          className="grid overflow-hidden rounded-[var(--r-card)]"
          style={{
            gap: GRID_GAP,
            gridTemplateColumns: "2fr 1fr",
            gridTemplateRows: "1fr 1fr",
            maxHeight: MAX_HEIGHT_DESKTOP,
            aspectRatio: "16/9",
          }}
        >
          <div className="relative row-span-2 min-h-0 overflow-hidden">
            <GridImage
              media={items[0]}
              alt={`${alt} — 1`}
              priority={priority}
              width={640}
              height={720}
              onClick={() => setLightbox(0)}
            />
          </div>
          <div className="relative min-h-0 overflow-hidden">
            <GridImage
              media={items[1]}
              alt={`${alt} — 2`}
              width={320}
              height={360}
              onClick={() => setLightbox(1)}
            />
          </div>
          <div className="relative min-h-0 overflow-hidden">
            <GridImage
              media={items[2]}
              alt={`${alt} — 3`}
              width={320}
              height={360}
              onClick={() => setLightbox(2)}
            />
          </div>
        </div>
        {lightbox !== null && (
          <Lightbox
            images={lightboxUrls}
            startIndex={lightbox}
            alt={alt}
            onClose={() => setLightbox(null)}
          />
        )}
      </>
    );
  }

  const visible = items.slice(0, 4);
  const extra = items.length - 4;

  return (
    <>
      <div
        className="grid grid-cols-2 overflow-hidden rounded-[var(--r-card)]"
        style={{ gap: GRID_GAP, maxHeight: MAX_HEIGHT_DESKTOP }}
      >
        {visible.map((item, i) => (
          <div key={item.url} className="relative aspect-square min-h-[100px] overflow-hidden">
            <GridImage
              media={item}
              alt={`${alt} — ${i + 1}`}
              priority={priority && i === 0}
              onClick={() => setLightbox(i)}
            />
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
      {lightbox !== null && (
        <Lightbox
          images={lightboxUrls}
          startIndex={lightbox}
          alt={alt}
          onClose={() => setLightbox(null)}
        />
      )}
    </>
  );
}
