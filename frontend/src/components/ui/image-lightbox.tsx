import { Lightbox } from "@/components/post/Lightbox";

/** Single-image convenience over the project's one Lightbox. */
export function ImageLightbox({
  src,
  alt,
  onClose,
}: {
  src: string;
  alt?: string;
  onClose: () => void;
}) {
  return <Lightbox slides={[{ type: "image", url: src }]} alt={alt} onClose={onClose} />;
}
