import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronLeft,
  Play,
  Eye,
  SearchX,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  Share2,
  Flag,
  Film,
  Clock,
  AlertTriangle,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Video, Comment } from "@/lib/mock";
import { userById } from "@/lib/mock";
import {
  fetchVideo,
  fetchVideos,
  incrementVideoView,
  reactToVideo,
  fetchVideoComments,
  createVideoComment,
} from "@/lib/api/reviews";
import { VideoCard } from "@/components/reviews/VideoCard";
import { ReviewPlayerSettings } from "@/components/reviews/ReviewPlayerSettings";
import { CommentSection } from "@/components/post/CommentSection";
import { CollapsibleText } from "@/components/ui/CollapsibleText";
import { Skeleton } from "@/components/ui/skeleton";
import { ComplaintDialog } from "@/components/friends/ComplaintDialog";
import { categoryPlaceholder } from "@/lib/placeholder-image";
import { formatDuration } from "@/lib/format-duration";
import { EmptyState } from "@/components/ui/empty-state";
import { ApiError } from "@/lib/api/client";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { appendToCommentThread, removeFromCommentThread } from "@/lib/comment-thread";
import { recordView } from "@/lib/view-history";
import { isWatchLater, toggleWatchLater, notifyWatchLaterChanged } from "@/lib/watch-later";
import { useCurrentUser } from "@/lib/session";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";

const actionCls =
  "inline-flex items-center gap-[6px] rounded-[10px] px-[10px] py-[7px] text-[13px] font-medium transition-colors hover:bg-[var(--accent-soft)]";

async function loadRelatedVideos(video: Video): Promise<Video[]> {
  try {
    let list = await fetchVideos({ categorySlug: video.categorySlug || undefined });
    list = list.filter((x) => x.id !== video.id);
    if (list.length < 4) {
      const [featured, all] = await Promise.all([fetchVideos({ featured: true }), fetchVideos({})]);
      const seen = new Set(list.map((x) => x.id));
      seen.add(video.id);
      for (const src of [featured, all]) {
        for (const item of src) {
          if (!seen.has(item.id)) {
            list.push(item);
            seen.add(item.id);
            if (list.length >= 8) break;
          }
        }
        if (list.length >= 8) break;
      }
    }
    return list.slice(0, 8);
  } catch {
    return [];
  }
}

/** Avatar with initials fallback — mirrors PostCard.AuthorAvatar */
function AuthorAvatar({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(false);
  const initials =
    name
      .split(" ")
      .slice(0, 2)
      .map((w) => w[0] ?? "")
      .join("")
      .toUpperCase() || "?";
  if (!src || err) {
    return (
      <div
        className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full text-[13px] font-bold text-white"
        style={{ background: "var(--accent)" }}
        aria-label={name}
      >
        {initials}
      </div>
    );
  }
  return (
    <img
      src={src}
      width={40}
      height={40}
      decoding="async"
      alt={name}
      loading="lazy"
      className="h-[40px] w-[40px] shrink-0 rounded-full object-cover"
      onError={() => setErr(true)}
    />
  );
}

import i18n from "@/lib/i18n";
import { formatDate } from "@/lib/format/date";

export const Route = createFileRoute("/reviews/$id")({
  head: () => ({ meta: [{ title: i18n.t("pages.reviews.detailMetaTitle") }] }),
  component: WatchPage,
});

type LoadState = "loading" | "ok" | "notFound" | "error";

/** Remount on id change so recommended-video navigation never reuses stale player state. */
function WatchPage() {
  const { id } = Route.useParams();
  return <WatchPageInner key={id} />;
}

function WatchPageInner() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<Video[] | null>(null);
  const [state, setState] = useState<LoadState>("loading");

  const [playing, setPlaying] = useState(false);
  const [playError, setPlayError] = useState<string | null>(null);
  const [posterFailed, setPosterFailed] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewedRef = useRef(false);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [disliked, setDisliked] = useState(false);
  const [dislikeCount, setDislikeCount] = useState(0);
  const [watchLater, setWatchLater] = useState(false);
  const [comments, setComments] = useState<Comment[]>([]);
  const [showAllComments, setShowAllComments] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);
  const currentUser = useCurrentUser();
  const { requireAccount, requirePremium } = useGuestAccess();

  useEffect(() => {
    // Reuse the landing's connection gate — only affects passive/ambient loading.
    if (typeof window === "undefined") return;
    const conn = (
      navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    const slow = !!conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType);
    setSaveData(conn?.saveData === true || slow);
  }, []);

  useEffect(() => {
    let alive = true;
    setState("loading");
    setPlaying(false);
    setPlayError(null);
    setPosterFailed(false);
    setRelated(null);
    viewedRef.current = false;
    fetchVideo(id)
      .then((v) => {
        if (!alive) return;
        setVideo(v);
        setState("ok");
        recordView({ id: v.id, kind: "review", title: v.title, thumb: v.posterUrl });
        setLiked(Boolean(v.isLiked));
        setLikeCount(v.likes);
        setDisliked(Boolean(v.isDisliked));
        setDislikeCount(v.dislikes ?? 0);
        setWatchLater(isWatchLater(v.id));
        fetchVideoComments(v.id)
          .then((cs) => {
            if (alive) setComments(cs);
          })
          .catch(() => {});
        loadRelatedVideos(v)
          .then((list) => {
            if (alive) setRelated(list);
          })
          .catch(() => {
            if (alive) setRelated([]);
          });
      })
      .catch((err) => {
        if (!alive) return;
        setVideo(null);
        setState(err instanceof ApiError && err.status === 404 ? "notFound" : "error");
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const startPlay = () => {
    if (!video?.videoUrl) {
      toast.error(t("pages.reviews.playbackUnavailable"));
      return;
    }
    if (video.status === "processing") {
      toast.info(t("pages.reviews.processing"));
      return;
    }
    requireAccount(() => {
      setPlayError(null);
      setPlaying(true);
      requestAnimationFrame(() => {
        const el = videoRef.current;
        if (!el) return;
        el.load();
        void el.play().catch(() => {
          setPlayError(t("pages.reviews.playbackFailed"));
        });
      });
      if (!viewedRef.current) {
        viewedRef.current = true;
        void incrementVideoView(id).catch(() => {});
      }
    });
  };

  const toggleLike = () => {
    requirePremium(() => {
      if (liked) {
        setLiked(false);
        setLikeCount((n) => n - 1);
        reactToVideo(id, null).catch(() => {
          setLiked(true);
          setLikeCount((n) => n + 1);
          toast.error(t("pages.reviews.likeFailed"));
        });
        return;
      }
      setLiked(true);
      setLikeCount((n) => n + 1);
      if (disliked) {
        setDisliked(false);
        setDislikeCount((n) => n - 1);
      }
      reactToVideo(id, "like").catch(() => {
        setLiked(false);
        setLikeCount((n) => n - 1);
        if (disliked) {
          setDisliked(true);
          setDislikeCount((n) => n + 1);
        }
        toast.error(t("pages.reviews.likeFailed"));
      });
    });
  };

  const toggleDislike = () => {
    requirePremium(() => {
      if (disliked) {
        setDisliked(false);
        setDislikeCount((n) => n - 1);
        reactToVideo(id, null).catch(() => {
          setDisliked(true);
          setDislikeCount((n) => n + 1);
          toast.error(t("pages.reviews.dislikeFailed"));
        });
        return;
      }
      setDisliked(true);
      setDislikeCount((n) => n + 1);
      if (liked) {
        setLiked(false);
        setLikeCount((n) => n - 1);
      }
      reactToVideo(id, "dislike").catch(() => {
        setDisliked(false);
        setDislikeCount((n) => n - 1);
        if (liked) {
          setLiked(true);
          setLikeCount((n) => n + 1);
        }
        toast.error(t("pages.reviews.dislikeFailed"));
      });
    });
  };

  const shareReview = async () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/reviews/${id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t("pages.reviews.linkCopied"));
    } catch {
      toast.info(t("pages.reviews.copyFromAddressBar"));
    }
  };

  const toggleWatchLaterState = () => {
    if (!video) return;
    requireAccount(() => {
      const next = toggleWatchLater({
        id: video.id,
        title: video.title,
        posterUrl: video.posterUrl,
      });
      setWatchLater(next);
      notifyWatchLaterChanged();
      toast.success(
        next ? t("pages.reviews.watchLaterAdded") : t("pages.reviews.watchLaterRemoved"),
      );
    });
  };

  const addComment = (
    text: string,
    parentId?: string,
    photos?: { mediaIds: string[]; urls: string[] },
  ) => {
    requirePremium(() => {
      void createVideoComment(id, text, parentId, photos?.mediaIds)
        .then((c) => {
          const saved =
            photos?.urls?.length && !c.images?.length ? { ...c, images: photos.urls } : c;
          if (parentId) {
            setComments((prev) => appendToCommentThread(prev, parentId, saved));
          } else {
            setComments((prev) => [saved, ...prev]);
          }
        })
        .catch((err) => {
          const message = formatApiErrorMessage(err, t("pages.reviews.commentFailed"));
          if (message) toast.error(message);
        });
    });
  };

  if (state === "loading") {
    return (
      <AppLayout rightColumn={false} footer>
        <div className="mx-auto max-w-[900px] py-[40px]">
          <div
            className="w-full animate-pulse"
            style={{
              aspectRatio: "16 / 9",
              background: "var(--background-surface)",
              borderRadius: "var(--r-card)",
            }}
          />
          <div className="mt-[20px] animate-pulse space-y-[12px]">
            <div
              style={{
                height: 24,
                width: "70%",
                background: "var(--background-surface)",
                borderRadius: "var(--r-input)",
              }}
            />
            <div className="flex items-center gap-[12px]">
              <div
                style={{
                  height: 40,
                  width: 40,
                  background: "var(--background-surface)",
                  borderRadius: "var(--r-pill)",
                }}
              />
              <div
                style={{
                  height: 16,
                  width: 140,
                  background: "var(--background-surface)",
                  borderRadius: "var(--r-input)",
                }}
              />
            </div>
            <div
              style={{
                height: 14,
                width: "100%",
                background: "var(--background-surface)",
                borderRadius: "var(--r-input)",
              }}
            />
            <div
              style={{
                height: 14,
                width: "85%",
                background: "var(--background-surface)",
                borderRadius: "var(--r-input)",
              }}
            />
          </div>
        </div>
      </AppLayout>
    );
  }
  if (state === "notFound" || state === "error" || !video) {
    return (
      <AppLayout rightColumn={false} footer>
        <div className="mx-auto max-w-[560px] py-[40px]">
          <EmptyState
            icon={SearchX}
            title={
              state === "notFound" ? t("pages.reviews.notFound") : t("pages.reviews.loadFailed")
            }
            description={t("pages.reviews.notFoundDesc")}
            action={{
              label: t("pages.reviews.toReviews"),
              onClick: () => navigate({ to: "/reviews" }),
            }}
          />
        </div>
      </AppLayout>
    );
  }

  const poster = posterFailed
    ? categoryPlaceholder(video.id, "")
    : video.posterUrl || categoryPlaceholder(video.id, "");
  const author = userById(video.uploaderId);
  const authorProfileId = author.slug ?? author.id;
  const isOwnReview = Boolean(
    currentUser?.id && (currentUser.id === video.uploaderId || currentUser.id === author.id),
  );
  const viewsCount = Number.isFinite(Number(video.views)) ? Number(video.views) : 0;
  const durationLabel = video.durationSeconds > 0 ? formatDuration(video.durationSeconds) : null;
  const canPlay = Boolean(video.videoUrl) && video.status !== "processing";
  const commentsCount =
    comments.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0) || video.comments;

  const authorBlock = (
    <>
      <AuthorAvatar src={author.avatar} name={author.name} />
      <div className="min-w-0">
        <div className="truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
          {author.name}
        </div>
        <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.reviews.authorLabel")}
        </div>
      </div>
    </>
  );

  return (
    <AppLayout rightColumn={false} footer>
      <div className="mx-auto flex max-w-[1000px] flex-col gap-[20px]">
        <Link
          to="/reviews"
          className="inline-flex items-center gap-[4px] text-[12px]"
          style={{ color: "var(--foreground-50)" }}
        >
          <ChevronLeft size={14} /> {t("pages.reviews.breadcrumb")}
        </Link>

        {/* player container — 16:9, object-contain letterboxes vertical videos */}
        <div
          className="relative w-full overflow-hidden"
          style={{ aspectRatio: "16 / 9", background: "#000", borderRadius: "var(--r-card)" }}
        >
          {!playing ? (
            <>
              <img
                src={poster}
                width={1600}
                height={900}
                loading="eager"
                fetchPriority="high"
                decoding="async"
                alt={video.title}
                className="h-full w-full object-contain"
                onError={() => setPosterFailed(true)}
              />
              {canPlay ? (
                <button
                  type="button"
                  onClick={startPlay}
                  aria-label={t("pages.reviews.watchAria")}
                  className="absolute inset-0 grid place-items-center"
                  style={{ background: "rgba(0,0,0,0.25)" }}
                >
                  <span
                    className="grid h-[64px] w-[64px] place-items-center rounded-full"
                    style={{ background: "var(--accent)" }}
                  >
                    <Play size={28} fill="#fff" color="#fff" />
                  </span>
                </button>
              ) : (
                <div
                  className="absolute inset-0 grid place-items-center px-[20px] text-center text-[13px] text-white"
                  style={{ background: "rgba(0,0,0,0.55)" }}
                >
                  <span className="inline-flex items-center gap-[6px]">
                    <AlertTriangle size={16} />
                    {video.status === "processing"
                      ? t("pages.reviews.processing")
                      : t("pages.reviews.playbackUnavailable")}
                  </span>
                </div>
              )}
              {durationLabel && (
                <span
                  className="absolute bottom-[10px] right-[10px] rounded-[6px] px-[8px] py-[3px] text-[11px] font-semibold text-white"
                  style={{ background: "rgba(0,0,0,0.75)" }}
                >
                  {durationLabel}
                </span>
              )}
              {saveData && canPlay && (
                <span
                  className="absolute left-[10px] top-[10px] rounded-[6px] px-[8px] py-[3px] text-[11px]"
                  style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}
                >
                  {t("pages.reviews.dataSaver")}
                </span>
              )}
            </>
          ) : (
            <>
              <video
                ref={videoRef}
                src={video.videoUrl}
                poster={poster}
                controls
                playsInline
                preload="none"
                controlsList="nodownload"
                onPlaying={() => setPlayError(null)}
                onError={() => setPlayError(t("pages.reviews.playbackFailed"))}
                className="h-full w-full object-contain"
              />
              <ReviewPlayerSettings videoRef={videoRef} visible={playing} />
              {playError && (
                <div
                  className="absolute inset-x-[12px] bottom-[12px] rounded-[10px] px-[12px] py-[10px] text-[12px] text-white"
                  style={{ background: "rgba(0,0,0,0.75)" }}
                >
                  {playError}
                </div>
              )}
            </>
          )}
        </div>

        {/* metadata */}
        <div className="flex flex-col gap-[8px]">
          <h1
            className="font-display text-[20px] font-bold leading-[1.25] sm:text-[24px]"
            style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
          >
            {video.title}
          </h1>
          <div
            className="flex flex-wrap items-center gap-x-[12px] gap-y-[6px] text-[12.5px]"
            style={{ color: "var(--foreground-50)" }}
          >
            <span className="inline-flex items-center gap-[4px]">
              <Eye size={13} />{" "}
              {t("pages.reviews.views", { count: viewsCount.toLocaleString("ru-RU") })}
            </span>
            {durationLabel && (
              <span className="inline-flex items-center gap-[4px]">
                <Clock size={13} /> {durationLabel}
              </span>
            )}
            {video.publishedAt && <span>· {formatDate(video.publishedAt, "absolute")}</span>}
            {video.categoryName && video.categorySlug && (
              <>
                <span aria-hidden>·</span>
                <Link
                  to="/reviews"
                  search={{ category: video.categorySlug }}
                  className="font-semibold transition-opacity hover:opacity-80"
                  style={{ color: "var(--accent)" }}
                >
                  {video.categoryName}
                </Link>
              </>
            )}
          </div>
        </div>

        {/* author */}
        {authorProfileId ? (
          <Link
            to="/user/$id"
            params={{ id: authorProfileId }}
            className="flex items-center gap-[10px] border-b pb-[12px]"
            style={{ borderColor: "var(--border)" }}
          >
            {authorBlock}
          </Link>
        ) : (
          <div
            className="flex items-center gap-[10px] border-b pb-[12px]"
            style={{ borderColor: "var(--border)" }}
          >
            {authorBlock}
          </div>
        )}

        {/* actions row — Rutube-style like/dislike + watch later + share */}
        <div className="flex flex-wrap items-center justify-between gap-[8px]">
          <div
            className="inline-flex items-center overflow-hidden rounded-full border"
            style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
          >
            <button
              type="button"
              onClick={toggleLike}
              aria-pressed={liked}
              className="inline-flex items-center gap-[6px] px-[14px] py-[8px] text-[13px] font-medium transition-colors hover:bg-[var(--accent-soft)]"
              style={{ color: liked ? "var(--accent)" : "var(--foreground-70)" }}
            >
              <ThumbsUp size={15} fill={liked ? "currentColor" : "none"} /> {likeCount}
            </button>
            <span
              className="h-[20px] w-px shrink-0"
              style={{ background: "var(--border)" }}
              aria-hidden
            />
            <button
              type="button"
              onClick={toggleDislike}
              aria-pressed={disliked}
              className="inline-flex items-center gap-[6px] px-[14px] py-[8px] text-[13px] font-medium transition-colors hover:bg-[var(--accent-soft)]"
              style={{ color: disliked ? "var(--accent)" : "var(--foreground-70)" }}
            >
              <ThumbsDown size={15} fill={disliked ? "currentColor" : "none"} /> {dislikeCount}
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-[4px]">
            <button
              type="button"
              onClick={toggleWatchLaterState}
              aria-pressed={watchLater}
              className={actionCls}
              style={{
                color: watchLater ? "var(--accent)" : "var(--foreground-70)",
                background: watchLater ? "var(--accent-soft)" : undefined,
              }}
            >
              <Bookmark size={16} fill={watchLater ? "currentColor" : "none"} />{" "}
              {watchLater ? t("pages.reviews.watchLaterRemove") : t("pages.reviews.watchLater")}
            </button>
            <button
              type="button"
              onClick={shareReview}
              aria-label={t("pages.reviews.share")}
              className={actionCls}
              style={{ color: "var(--foreground-70)" }}
            >
              <Share2 size={16} /> {t("pages.reviews.share")}
            </button>
            {!isOwnReview && (
              <button
                type="button"
                onClick={() => {
                  requireAccount(() => setReportOpen(true));
                }}
                aria-label={t("pages.reviews.report")}
                className={actionCls}
                style={{ color: "var(--foreground-70)" }}
              >
                <Flag size={16} /> {t("pages.reviews.report")}
              </button>
            )}
          </div>
        </div>

        {video.description && <CollapsibleText text={video.description} maxLines={6} />}

        {video.tags.length > 0 && (
          <div className="flex flex-wrap items-center gap-[8px]">
            {video.tags.map((tag) => (
              <Link
                key={tag}
                to="/reviews"
                search={{ tag }}
                className="rounded-full px-[10px] py-[4px] text-[11px] font-medium transition-colors hover:bg-[var(--accent-soft)]"
                style={{
                  background: "var(--background-surface)",
                  color: "var(--foreground-70)",
                  border: "1px solid var(--border)",
                }}
              >
                #{tag}
              </Link>
            ))}
          </div>
        )}

        {/* comments — always open with input visible */}
        <section className="space-y-[12px]">
          <h2
            className="font-display text-[18px] font-bold"
            style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
          >
            {t("pages.reviews.commentsCount", { count: commentsCount })}
          </h2>
          <CommentSection
            comments={comments}
            onAdd={addComment}
            onDeleted={(id) => setComments((prev) => removeFromCommentThread(prev, id))}
            previewLimit={3}
            showAll={showAllComments}
            onShowAll={() => setShowAllComments(true)}
            onHide={() => setShowAllComments(false)}
            totalCount={commentsCount}
          />
        </section>

        {/* recommended reviews */}
        <section
          className="min-h-[220px] space-y-[12px] rounded-[var(--r-card)] border p-[16px]"
          style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
        >
          <h2
            className="flex items-center gap-[8px] font-display text-[18px] font-bold"
            style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
          >
            <Film size={18} style={{ color: "var(--foreground-50)" }} />{" "}
            {t("pages.reviews.recommended")}
          </h2>
          {related === null ? (
            <div className="-mx-[16px] flex snap-x snap-mandatory gap-[12px] overflow-hidden px-[16px] sm:mx-0 sm:px-0">
              {Array.from({ length: 4 }, (_, i) => (
                <div key={i} className="snap-start shrink-0" style={{ flex: "0 0 240px" }}>
                  <Skeleton
                    className="w-full rounded-[var(--r-card)]"
                    style={{ aspectRatio: "16 / 9" }}
                  />
                  <Skeleton className="mt-[8px] h-[14px] w-[90%]" />
                </div>
              ))}
            </div>
          ) : related.length > 0 ? (
            <div
              className="-mx-[16px] flex snap-x snap-mandatory gap-[12px] overflow-x-auto px-[16px] pb-[8px] sm:mx-0 sm:px-0"
              style={{ scrollbarWidth: "thin" }}
            >
              {related.map((v) => (
                <div key={v.id} className="snap-start" style={{ flex: "0 0 240px" }}>
                  <VideoCard video={v} />
                </div>
              ))}
            </div>
          ) : (
            <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.reviews.recommendedEmpty")}
            </p>
          )}
        </section>
      </div>

      {reportOpen && (
        <ComplaintDialog
          target={author}
          descriptionOverride={t("pages.reviews.supportDescription", {
            title: video.title ? ` «${video.title}»` : "",
            defaultValue: `Обращение по обзору${video.title ? ` «${video.title}»` : ""} — опишите проблему, мы передадим сообщение в поддержку.`,
          })}
          page={`/reviews/${video.id}`}
          subjectSuffix={t("pages.reviews.reportSuffix")}
          onClose={() => setReportOpen(false)}
        />
      )}
    </AppLayout>
  );
}
