import { PostMediaCarousel, type MediaCarouselItem } from "@/components/feed/PostMediaCarousel";

/** Image-only gallery wrapper (backward compatible). */
export function PostGallery({ images, alt }: { images: string[]; alt: string }) {
  const items: MediaCarouselItem[] = images.map((url) => ({ type: "image", url }));
  return <PostMediaCarousel items={items} alt={alt} />;
}
