import { useState } from "react";
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
  draggable,
  onError,
  onClick,
}: Props) {
  const [failed, setFailed] = useState(false);
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
