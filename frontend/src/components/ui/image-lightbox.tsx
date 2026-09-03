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
  return <Lightbox images={[src]} alt={alt} onClose={onClose} />;
}
