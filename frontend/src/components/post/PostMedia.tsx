import { useTranslation } from "react-i18next";
import { AlertTriangle, Loader2 } from "lucide-react";
import type { Post, PostMediaItem } from "@/lib/mock";
import { PostMediaCarousel, carouselViewerUrls } from "@/components/feed/PostMediaCarousel";
import { FeedMediaGrid, viewerUrls } from "@/components/feed/FeedMediaGrid";

/** Media block: VK grid for images-only; carousel when video is present. */
function VideoProcessingFrame({ failed }: { failed: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex aspect-video w-full flex-col items-center justify-center gap-[10px] px-[16px] text-center"
      style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}
    >
      {failed ? (
        <AlertTriangle
          className="h-[22px] w-[22px]"
          style={{ color: "var(--destructive, #d94b4b)" }}
        />
      ) : (
        <Loader2 className="h-[22px] w-[22px] animate-spin" style={{ color: "var(--accent)" }} />
      )}
      <p className="text-[13px] font-medium">
        {failed ? t("components.postCard.videoFailed") : t("components.postCard.videoProcessing")}
      </p>
    </div>
  );
}

/**
 * Медиа записи в том виде, в каком его показывает лента: готовый список
 * `mediaItems`, а если его нет — собранный из отдельных полей.
 *
 * Вынесено наружу, потому что список нужен двоим: этому компоненту, чтобы
 * рисовать, и карточке, чтобы знать адреса снимков для просмотрщика. Считать
 * его в двух местах по-разному — верный способ разойтись в нумерации.
 */
export function postMediaItems(post: Post): PostMediaItem[] {
  return (
    post.mediaItems ?? [
      ...(post.video ? [{ type: "video" as const, url: post.video }] : []),
      ...(post.images?.length
        ? post.images.map((url) => ({ type: "image" as const, url }))
        : post.image
          ? [{ type: "image" as const, url: post.image }]
          : []),
    ]
  );
}

/**
 * Адреса снимков записи для просмотрщика — ровно в том порядке, в котором
 * их нумерует показывающий компонент: карусель, когда есть видео, и сетка
 * во всех остальных случаях.
 */
export function postViewerImages(post: Post): string[] {
  const items = postMediaItems(post);
  if (items.length === 0) return [];
  if (items.some((item) => item.type === "video")) return carouselViewerUrls(items);
  return viewerUrls(
    items
      .filter((item) => item.type === "image")
      .map((item) => ({ url: item.url, variants: item.variants })),
  );
}

export function PostMedia({
  post,
  priority = false,
  onOpenViewer,
}: {
  post: Post;
  priority?: boolean;
  /** Открыть просмотрщик на снимке с этим номером. Окно рисует карточка. */
  onOpenViewer?: (index: number) => void;
}) {
  const items: PostMediaItem[] = postMediaItems(post);

  if (items.length === 0) return null;

  const videoSlide = items.find((item) => item.type === "video");
  if (
    videoSlide &&
    (videoSlide.status === "pending" || videoSlide.status === "failed" || !videoSlide.url)
  ) {
    return <VideoProcessingFrame failed={videoSlide.status === "failed"} />;
  }

  const hasVideo = items.some((item) => item.type === "video");
  if (hasVideo) {
    return (
      <PostMediaCarousel
        items={items}
        alt={post.title}
        priority={priority}
        onOpenViewer={onOpenViewer}
      />
    );
  }

  const imageItems = items
    .filter((item) => item.type === "image")
    .map((item) => ({ url: item.url, variants: item.variants }));
  return (
    <FeedMediaGrid
      images={imageItems}
      alt={post.title}
      priority={priority}
      onOpenViewer={onOpenViewer}
    />
  );
}
