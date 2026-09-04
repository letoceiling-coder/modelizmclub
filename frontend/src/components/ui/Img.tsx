import * as React from "react";

type NativeImgProps = React.ImgHTMLAttributes<HTMLImageElement>;

export interface ImgProps extends Omit<
  NativeImgProps,
  "width" | "height" | "loading" | "decoding"
> {
  /**
   * Intrinsic size — required. The browser reserves the box from these before
   * the bytes arrive, which is what keeps CLS at zero; CSS (object-cover,
   * h-full) still decides how it is painted. Use the media's real dimensions
   * when the API provides them, the design size for avatars and thumbnails.
   */
  width: number | string;
  height: number | string;
  /**
   * LCP candidate (hero cover, first image in the feed): loads eagerly with
   * fetchpriority=high. Everything else lazy-loads.
   */
  priority?: boolean;
  loading?: NativeImgProps["loading"];
  decoding?: NativeImgProps["decoding"];
}

/**
 * <img> with the sizing contract enforced by the type system. New images go
 * through this component so a missing width/height is a compile error, not a
 * layout shift found in Lighthouse.
 */
export const Img = React.forwardRef<HTMLImageElement, ImgProps>(function Img(
  { priority = false, loading, decoding = "async", ...props },
  ref,
) {
  return (
    <img
      ref={ref}
      loading={loading ?? (priority ? "eager" : "lazy")}
      decoding={decoding}
      fetchPriority={priority ? "high" : undefined}
      {...props}
    />
  );
});
