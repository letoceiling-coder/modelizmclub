import { useState } from "react";
import { pictureSrcSet, type DisplayMedia } from "@/lib/media/variants";

type VariantName = "thumb" | "card" | "medium" | "large";

interface Props {
  media: DisplayMedia;
  alt: string;
  variants: VariantName[];
  sizes: string;
  className?: string;
  loading?: "lazy" | "eager";
  decoding?: "async" | "auto" | "sync";
  draggable?: boolean;
  width?: number;
  height?: number;
  onError?: () => void;
  onClick?: () => void;
}

export function ResponsiveImage({
  media,
  alt,
  variants,
  sizes,
  className,
  loading = "lazy",
  decoding = "async",
  draggable,
  width,
  height,
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

  if (!picture.webp && !picture.jpeg) {
    return (
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        decoding={decoding}
        draggable={draggable}
        width={width}
        height={height}
        onError={handleError}
        onClick={onClick}
      />
    );
  }

  return (
    <picture>
      {picture.webp && !failed ? <source type="image/webp" srcSet={picture.webp} sizes={sizes} /> : null}
      {picture.jpeg && !failed ? <source type="image/jpeg" srcSet={picture.jpeg} sizes={sizes} /> : null}
      <img
        src={src}
        alt={alt}
        className={className}
        loading={loading}
        decoding={decoding}
        draggable={draggable}
        width={width}
        height={height}
        onError={handleError}
        onClick={onClick}
      />
    </picture>
  );
}
