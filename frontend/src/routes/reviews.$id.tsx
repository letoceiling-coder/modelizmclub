import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { ChevronLeft, Play, Eye, SearchX, RefreshCw, Heart, ChevronDown, Film } from "lucide-react";
import { toast } from "@/lib/toast";
import { AnimatePresence, motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Video, Comment } from "@/lib/mock";
import { userById } from "@/lib/mock";
import { fetchVideo, fetchVideos, incrementVideoView, reactToVideo, fetchVideoComments, createVideoComment } from "@/lib/api/reviews";
import { VideoCard } from "@/components/reviews/VideoCard";
import { CommentSection } from "@/components/feed/CommentSection";
import { VideoActionsMenu } from "@/components/reviews/VideoActionsMenu";
import { categoryPlaceholder } from "@/lib/placeholder-image";
import { EmptyState } from "@/components/ui/empty-state";
import { getToken, ApiError } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import { recordView } from "@/lib/view-history";

/** Avatar with initials fallback — mirrors PostCard.AuthorAvatar */
function AuthorAvatar({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(false);
  const initials = name.split(" ").slice(0, 2).map((w) => w[0] ?? "").join("").toUpperCase() || "?";
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
    <img src={src} alt={name} loading="lazy" className="h-[40px] w-[40px] shrink-0 rounded-full object-cover" onError={() => setErr(true)} />
  );
}

export const Route = createFileRoute("/reviews/$id")({
  head: () => ({ meta: [{ title: "Обзор — МоДелизМ" }] }),
  component: WatchPage,
});

type LoadState = "loading" | "ok" | "notFound" | "error";

function WatchPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const [video, setVideo] = useState<Video | null>(null);
  const [related, setRelated] = useState<Video[]>([]);
  const [state, setState] = useState<LoadState>("loading");

  const [playing, setPlaying] = useState(false);   // has the user tapped play?
  const [buffering, setBuffering] = useState(false);
  const [saveData, setSaveData] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const viewedRef = useRef(false);

  const [liked, setLiked] = useState(false);
  const [likeCount, setLikeCount] = useState(0);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentsOpen, setCommentsOpen] = useState(false);

  useEffect(() => {
    // Reuse the landing's connection gate — only affects passive/ambient loading.
    if (typeof window === "undefined") return;
    const conn = (navigator as unknown as { connection?: { saveData?: boolean; effectiveType?: string } }).connection;
    const slow = !!conn?.effectiveType && /(^|-)2g$/.test(conn.effectiveType);
    setSaveData(conn?.saveData === true || slow);
  }, []);

  useEffect(() => {
    let alive = true;
    setState("loading");
    setPlaying(false);
    setCommentsOpen(false);
    viewedRef.current = false;
    fetchVideo(id)
      .then((v) => {
        if (!alive) return;
        setVideo(v);
        setState("ok");
        recordView({ id: v.id, kind: "review", title: v.title, thumb: v.posterUrl });
        setLiked(Boolean(v.isLiked));
        setLikeCount(v.likes);
        fetchVideoComments(v.id).then((cs) => { if (alive) setComments(cs); }).catch(() => {});
        fetchVideos({ categorySlug: undefined })
          .then((list) => { if (alive) setRelated(list.filter((x) => x.id !== v.id).slice(0, 8)); })
          .catch(() => {});
      })
      .catch((err) => {
        if (!alive) return;
        setVideo(null);
        setState(err instanceof ApiError && err.status === 404 ? "notFound" : "error");
      });
    return () => { alive = false; };
  }, [id]);

  const startPlay = () => {
    if (!getToken() && !isDemoMode()) {
      toast.info("Войдите, чтобы смотреть обзоры");
      navigate({ to: "/login" });
      return;
    }
    setPlaying(true);
    // Attach src + play on the next tick (after the <video> renders with src).
    requestAnimationFrame(() => {
      const el = videoRef.current;
      if (!el) return;
      el.load();
      void el.play().catch(() => {});
    });
    if (!viewedRef.current) {
      viewedRef.current = true;
      void incrementVideoView(id).catch(() => {});
    }
  };

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikeCount((n) => n + (next ? 1 : -1));
    reactToVideo(id, next).catch(() => {
      setLiked(!next);
      setLikeCount((n) => n + (next ? -1 : 1));
      toast.error("Не удалось поставить лайк");
    });
  };

  const addComment = (text: string, parentId?: string) => {
    void createVideoComment(id, text, parentId).then((c) => {
      if (parentId) {
        setComments((prev) =>
          prev.map((p) => (p.id === parentId ? { ...p, replies: [...(p.replies ?? []), c] } : p)),
        );
      } else {
        setComments((prev) => [c, ...prev]);
      }
    }).catch(() => {
      toast.error("Не удалось отправить комментарий");
    });
  };

  if (state === "loading") {
    return (
      <AppLayout rightColumn={false}>
        <div className="mx-auto max-w-[900px] py-[40px]">
          <div className="w-full animate-pulse" style={{ aspectRatio: "16 / 9", background: "var(--background-surface)", borderRadius: "var(--r-card)" }} />
        </div>
      </AppLayout>
    );
  }
  if (state === "notFound" || state === "error" || !video) {
    return (
      <AppLayout rightColumn={false}>
        <div className="mx-auto max-w-[560px] py-[40px]">
          <EmptyState
            icon={SearchX}
            title={state === "notFound" ? "Обзор не найден" : "Не удалось загрузить обзор"}
            description="Возможно, он был удалён или ссылка устарела."
            action={{ label: "К обзорам", onClick: () => navigate({ to: "/reviews" }) }}
          />
        </div>
      </AppLayout>
    );
  }

  const poster = video.posterUrl || categoryPlaceholder(video.id, "");
  const author = userById(video.uploaderId);

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[1000px] flex-col gap-[20px]">
        <Link to="/reviews" className="inline-flex items-center gap-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          <ChevronLeft size={14} /> Обзоры
        </Link>

        {/* player container — 16:9, object-contain letterboxes vertical videos */}
        <div className="relative w-full overflow-hidden" style={{ aspectRatio: "16 / 9", background: "#000", borderRadius: "var(--r-card)" }}>
          {!playing ? (
            <>
              <img
                src={poster}
                alt={video.title}
                className="h-full w-full object-contain"
                loading={saveData ? "lazy" : "eager"}
              />
              <button
                type="button"
                onClick={startPlay}
                aria-label="Смотреть"
                className="absolute inset-0 grid place-items-center"
                style={{ background: "rgba(0,0,0,0.25)" }}
              >
                <span className="grid h-[64px] w-[64px] place-items-center rounded-full" style={{ background: "var(--accent)" }}>
                  <Play size={28} fill="#fff" color="#fff" />
                </span>
              </button>
              {saveData && (
                <span className="absolute left-[10px] top-[10px] rounded-[6px] px-[8px] py-[3px] text-[11px]" style={{ background: "rgba(0,0,0,0.7)", color: "#fff" }}>
                  Экономия трафика — видео загрузится по тапу
                </span>
              )}
            </>
          ) : (
            <>
              <video
                ref={videoRef}
                poster={poster}
                controls
                playsInline
                preload="none"
                controlsList="nodownload"
                onWaiting={() => setBuffering(true)}
                onPlaying={() => setBuffering(false)}
                onCanPlay={() => setBuffering(false)}
                className="h-full w-full object-contain"
              >
                <source src={video.videoUrl} type="video/mp4" />
              </video>
              {buffering && (
                <div className="pointer-events-none absolute inset-0 grid place-items-center">
                  <RefreshCw size={32} className="animate-spin" color="#fff" />
                </div>
              )}
            </>
          )}
        </div>

        {/* metadata */}
        <div className="flex flex-col gap-[8px]">
          <h1 className="font-display text-[20px] font-bold leading-[1.25] sm:text-[24px]" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            {video.title}
          </h1>
          <div className="flex items-center gap-[12px] text-[12.5px]" style={{ color: "var(--foreground-50)" }}>
            <span className="inline-flex items-center gap-[4px]"><Eye size={13} /> {video.views.toLocaleString("ru")} просмотров</span>
            {video.publishedAt && <span>· {new Date(video.publishedAt).toLocaleDateString("ru", { day: "numeric", month: "long", year: "numeric" })}</span>}
          </div>
        </div>

        {/* author */}
        <Link
          to="/user/$id"
          params={{ id: author.slug ?? author.id }}
          className="flex items-center gap-[10px] border-b pb-[16px]"
          style={{ borderColor: "var(--border)" }}
        >
          <AuthorAvatar src={author.avatar} name={author.name} />
          <div className="min-w-0">
            <div className="truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{author.name}</div>
            <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>Автор обзора</div>
          </div>
        </Link>

        {/* actions row — Like / Share / Report, referenced against YouTube/Avito layout */}
        <div className="flex flex-wrap items-center gap-[4px]">
          <button
            type="button"
            onClick={toggleLike}
            aria-pressed={liked}
            className="inline-flex items-center gap-[6px] rounded-full px-[14px] py-[8px] text-[13px] font-medium transition-colors"
            style={{
              background: liked ? "var(--accent-soft)" : "var(--background-surface)",
              color: liked ? "var(--accent)" : "var(--foreground-70)",
              border: `1px solid ${liked ? "var(--border-accent)" : "var(--border)"}`,
            }}
          >
            <Heart size={15} fill={liked ? "currentColor" : "none"} /> {likeCount}
          </button>
          <VideoActionsMenu videoId={video.id} />
        </div>

        {video.description && (
          <p className="whitespace-pre-line text-[14px] leading-[1.6]" style={{ color: "var(--foreground-90)" }}>
            {video.description}
          </p>
        )}

        {/* comments — collapsed by default, expand on click */}
        <section className="space-y-[12px] border-t pt-[16px]" style={{ borderColor: "var(--border)" }}>
          <button
            type="button"
            onClick={() => setCommentsOpen((v) => !v)}
            className="flex w-full items-center justify-between text-left"
            aria-expanded={commentsOpen}
          >
            <h2 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Комментарии {comments.length > 0 && <span style={{ color: "var(--foreground-50)" }}>{comments.length}</span>}
            </h2>
            <ChevronDown
              size={18}
              style={{ color: "var(--foreground-50)", transform: commentsOpen ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
            />
          </button>

          {!commentsOpen && comments[0] && (
            <button
              type="button"
              onClick={() => setCommentsOpen(true)}
              className="flex w-full items-start gap-[10px] rounded-[var(--r-card-sm)] p-[10px] text-left transition-colors hover:bg-[var(--background-surface)]"
            >
              <AuthorAvatar src={userById(comments[0].authorId).avatar} name={userById(comments[0].authorId).name} />
              <div className="min-w-0 flex-1">
                <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{userById(comments[0].authorId).name}</div>
                <div className="truncate text-[13px]" style={{ color: "var(--foreground-70)" }}>{comments[0].text}</div>
              </div>
            </button>
          )}

          <AnimatePresence initial={false}>
            {commentsOpen && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
                className="overflow-hidden"
              >
                <CommentSection comments={comments} onAdd={addComment} />
              </motion.div>
            )}
          </AnimatePresence>
        </section>

        {/* related videos */}
        {related.length > 0 && (
          <section
            className="space-y-[12px] rounded-[var(--r-card)] border p-[16px]"
            style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
          >
            <h2 className="flex items-center gap-[8px] font-display text-[18px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              <Film size={18} style={{ color: "var(--foreground-50)" }} /> Похожие обзоры
            </h2>
            <div className="-mx-[16px] flex snap-x snap-mandatory gap-[12px] overflow-x-auto px-[16px] pb-[8px] sm:mx-0 sm:px-0" style={{ scrollbarWidth: "thin" }}>
              {related.map((v) => (
                <div key={v.id} className="snap-start" style={{ flex: "0 0 240px" }}>
                  <VideoCard video={v} />
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </AppLayout>
  );
}
