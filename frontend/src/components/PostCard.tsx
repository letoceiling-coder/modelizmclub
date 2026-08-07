import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Heart, MessageCircle, Bookmark, Eye, Repeat2, Clock } from "lucide-react";
import type { Post, Comment } from "@/lib/mock";
import { userById, formatRelativeTime } from "@/lib/mock";
import { useStore, selectors } from "@/lib/store";
import {
  reactToPost,
  bookmarkPost,
  repostPost,
  fetchPostComments,
  createComment,
  publishPost,
  cancelScheduledPost,
} from "@/lib/api/feed";
import { formatScheduledAt, defaultScheduleTimezone } from "@/lib/post-schedule";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { CommentSection } from "@/components/feed/CommentSection";
import { PostMediaCarousel } from "@/components/feed/PostMediaCarousel";
import { RepostMenu } from "@/components/feed/RepostMenu";
import { PostActionMenu } from "@/components/post/PostActionMenu";
import { SchedulePostDialog } from "@/components/feed/SchedulePostDialog";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";

interface Props {
  post: Post;
  onTogglePost?: (id: string, patch: Partial<Post>) => void;
  isSavedExternal?: boolean;
  onToggleSave?: (id: string) => void;
  onDelete?: (id: string) => void;
  onHide?: (id: string) => void;
}

/** Avatar with initials fallback when the image fails to load or src is empty */
function AuthorAvatar({ src, name }: { src: string; name: string }) {
  const [err, setErr] = useState(false);
  const initials = name
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
      alt={name}
      loading="lazy"
      className="h-[40px] w-[40px] shrink-0 rounded-full object-cover"
      onError={() => setErr(true)}
    />
  );
}

/** Media block: mixed video/images in a single carousel. */
function PostMediaBlock({ post }: { post: Post }) {
  const items =
    post.mediaItems ??
    [
      ...(post.video ? [{ type: "video" as const, url: post.video }] : []),
      ...(post.images?.length ? post.images.map((url) => ({ type: "image" as const, url })) : post.image ? [{ type: "image" as const, url: post.image }] : []),
    ];

  if (items.length === 0) return null;

  return <PostMediaCarousel items={items} alt={post.title} />;
}

/** Shared class for footer action buttons — ghost-style, accent hover */
const actionCls =
  "inline-flex items-center gap-[6px] rounded-[10px] px-[10px] py-[7px] text-[13px] font-medium transition-colors hover:bg-[var(--accent-soft)] disabled:pointer-events-none disabled:opacity-45";

export function PostCard({ post, isSavedExternal, onToggleSave, onDelete, onHide, onTogglePost }: Props) {
  const { t } = useTranslation();
  const me = useStore(selectors.currentUser);
  const author = userById(post.authorId);
  const reposter = post.repostedBy ? userById(post.repostedBy) : null;
  const isStaff = me.role === "admin" || me.role === "moderator" || !!me.isAdmin;
  const canDelete = post.canDelete || post.authorId === me.id || isStaff;

  const [liked, setLiked] = useState(!!post.isLiked);
  const [savedInner, setSavedInner] = useState(!!post.isSaved);
  const saved = isSavedExternal ?? savedInner;
  const [reposted, setReposted] = useState(!!post.isReposted);
  const [expanded, setExpanded] = useState(false);
  const [showAllComments, setShowAllComments] = useState(false);
  const commentsRef = useRef<HTMLDivElement>(null);

  const [likes, setLikes] = useState(post.likes);
  const [saves, setSaves] = useState(post.saves ?? 0);
  const [reposts, setReposts] = useState(post.reposts ?? 0);
  const [commentList, setCommentList] = useState<Comment[]>(post.commentList ?? []);
  const [commentsFetchStarted, setCommentsFetchStarted] = useState((post.commentList?.length ?? 0) > 0);
  const [commentsFetched, setCommentsFetched] = useState((post.commentList?.length ?? 0) > 0);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const { guardAction } = useGuestAccess();
  const isScheduled = post.status === "scheduled";
  const canInteract = post.canInteract ?? post.status === "published";
  const hasCommentsHint = (post.comments ?? 0) > 0 || (post.commentList?.length ?? 0) > 0;

  const startCommentsFetch = useCallback(() => {
    if (commentsFetchStarted) return;
    setCommentsFetchStarted(true);
    fetchPostComments(post.id)
      .then((list) => {
        setCommentList(list);
        setCommentsFetched(true);
      })
      .catch(() => setCommentsFetched(true));
  }, [commentsFetchStarted, post.id]);

  useEffect(() => {
    if (hasCommentsHint || canInteract) startCommentsFetch();
  }, [hasCommentsHint, canInteract, startCommentsFetch]);

  const isLong = post.text.length > 220;
  const shown = !isLong || expanded ? post.text : post.text.slice(0, 220) + "…";
  const commentsCount =
    commentList.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0) || post.comments;

  const focusComments = () => {
    commentsRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const input = commentsRef.current?.querySelector("input");
    if (input instanceof HTMLInputElement) input.focus();
  };

  const toggleComments = () => {
    if (showAllComments) {
      focusComments();
      return;
    }
    if (commentsCount > 3) {
      setShowAllComments(true);
      startCommentsFetch();
      return;
    }
    if (!canInteract && commentsCount === 0) return;
    guardAction("feed.post.comment", focusComments);
  };

  const toggleLike = () => {
    if (!canInteract) return;
    guardAction("feed.post.like", () => {
      const next = !liked;
      setLiked(next);
      setLikes((n) => n + (next ? 1 : -1));
      reactToPost(post.id, next).catch(() => {
        setLiked(!next);
        setLikes((n) => n + (next ? -1 : 1));
      });
    });
  };
  const toggleSave = () => {
    if (!canInteract) return;
    guardAction("feed.post.save", () => {
      const next = !saved;
      if (onToggleSave) onToggleSave(post.id);
      else setSavedInner((v) => !v);
      setSaves((n) => n + (next ? 1 : -1));
      bookmarkPost(post.id, next).catch(() => {
        if (!onToggleSave) setSavedInner((v) => !v);
        setSaves((n) => n + (next ? -1 : 1));
      });
    });
  };
  const toggleRepost = () => {
    if (!canInteract || isScheduled) return;
    guardAction("feed.post.repost", () => {
      const next = !reposted;
      setReposted(next);
      setReposts((n) => n + (next ? 1 : -1));
      repostPost(post.id, next).catch(() => {
        setReposted(!next);
        setReposts((n) => n + (next ? -1 : 1));
      });
    });
  };

  const addComment = (text: string, parentId?: string) => {
    if (!canInteract) return;
    guardAction("feed.post.comment", () => {
      const tempId = `nc${Date.now()}`;
      const newC: Comment = {
        id: tempId,
        authorId: me.id,
        time: t("components.postCard.justNow"),
        text,
        likes: 0,
        replies: [],
      };
      setCommentList((list) => {
        if (!parentId) return [...list, newC];
        return list.map((c) =>
          c.id === parentId ? { ...c, replies: [...(c.replies ?? []), newC] } : c,
        );
      });
      createComment(post.id, text, parentId)
        .then((saved) => {
          setCommentList((list) => {
            if (!parentId) return list.map((c) => (c.id === tempId ? saved : c));
            return list.map((c) =>
              c.id === parentId
                ? { ...c, replies: (c.replies ?? []).map((r) => (r.id === tempId ? saved : r)) }
                : c,
            );
          });
        })
        .catch(() => {});
    });
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
    >
      <Card
        className={cn(
          "overflow-hidden rounded-none border-[var(--border)] shadow-[var(--shadow-card)]",
          "sm:rounded-[var(--r-card)]",
        )}
      >
        {/* Repost bar */}
        {reposter && (
          <div
            className="flex items-center gap-[8px] border-b px-[16px] py-[8px] text-[12px]"
            style={{
              color: "var(--foreground-70)",
              borderColor: "var(--border)",
              background: "var(--background-overlay)",
            }}
          >
            <Repeat2 className="h-[14px] w-[14px]" style={{ color: "var(--accent)" }} />
            <span>
              <span style={{ color: "var(--foreground)", fontWeight: 600 }}>{reposter.name}</span>{" "}
              {t("components.postCard.reposted")}
            </span>
          </div>
        )}

        {/* Header */}
        <header className="flex items-center gap-[12px] px-[16px] pt-[16px]">
          <AuthorAvatar src={author.avatar} name={author.name} />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[8px]">
              <span
                className="truncate text-[14px] font-semibold"
                style={{ color: "var(--foreground)" }}
              >
                {author.name}
              </span>
              {post.status === "moderation" && (
                <StatusBadge variant="moderation">{t("components.postCard.moderation")}</StatusBadge>
              )}
              {isScheduled && (
                <StatusBadge variant="info">{t("components.postCard.scheduled")}</StatusBadge>
              )}
            </div>
            <div className="mt-[1px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {isScheduled && post.scheduledAt
                ? formatScheduledAt(post.scheduledAt, defaultScheduleTimezone())
                : formatRelativeTime(post.date)}
              {post.category && (
                <>
                  {" · "}
                  <span>{post.category}</span>
                </>
              )}
            </div>
          </div>
          <PostActionMenu
            postId={post.id}
            saved={saved}
            title={post.title}
            text={post.text}
            status={post.status}
            canInteract={canInteract}
            canDelete={canDelete}
            isStaff={isStaff}
            author={author}
            isOwn={post.authorId === me.id}
            onDeleted={() => onDelete?.(post.id)}
            onApproved={() => onTogglePost?.(post.id, { status: "published" })}
            onToggleSave={toggleSave}
            onHide={() => onHide?.(post.id)}
            canPublishNow={isScheduled && (post.canPublish || post.authorId === me.id)}
            canReschedule={isScheduled && post.authorId === me.id}
            canCancelSchedule={isScheduled && (post.canCancelSchedule || post.authorId === me.id)}
            onPublishNow={async () => {
              try {
                const updated = await publishPost(post.id);
                onTogglePost?.(post.id, { status: updated.status, scheduledAt: undefined });
                toast.success(t("components.postCard.published"));
              } catch (err) {
                toast.error(formatApiErrorMessage(err, t("components.postCard.publishFailed")));
              }
            }}
            onReschedule={() => setScheduleDialogOpen(true)}
            onCancelSchedule={async () => {
              if (!window.confirm(t("components.postCard.cancelScheduleConfirm"))) return;
              try {
                await cancelScheduledPost(post.id);
                onDelete?.(post.id);
                toast.success(t("components.postCard.cancelled"));
              } catch (err) {
                toast.error(formatApiErrorMessage(err, t("components.postCard.cancelFailed")));
              }
            }}
          />
        </header>

        {isScheduled && post.scheduledAt && (
          <div
            className="mx-[16px] mt-[12px] flex items-center gap-[8px] rounded-[10px] border px-[12px] py-[10px] text-[13px]"
            style={{
              borderColor: "color-mix(in oklab, var(--accent) 25%, var(--border))",
              background: "color-mix(in oklab, var(--accent) 6%, var(--background-surface))",
              color: "var(--foreground-70)",
            }}
          >
            <Clock className="h-[16px] w-[16px] shrink-0" style={{ color: "var(--accent)" }} />
            <span>
              {t("components.postCard.scheduledFor")}{" "}
              <strong style={{ color: "var(--foreground)" }}>{formatScheduledAt(post.scheduledAt, defaultScheduleTimezone())}</strong>
            </span>
          </div>
        )}

        {/* Content */}
        <div className="px-[16px] pb-[12px] pt-[12px]">
          <h3
            className="line-clamp-2 break-words text-[17px] font-semibold leading-tight"
            style={{
              fontFamily: "var(--font-display)",
              color: "var(--foreground)",
              letterSpacing: "-0.01em",
            }}
          >
            {post.title}
          </h3>

          {post.tags && post.tags.length > 0 && (
            <div className="mt-[8px] flex flex-wrap gap-[6px]">
              {post.tags.map((t) => (
                <Badge
                  key={t}
                  variant="secondary"
                  withIcon={false}
                  className="rounded-[6px] border-transparent bg-[var(--accent-soft)] px-[8px] py-[3px] font-mono text-[11px] text-[var(--accent)]"
                >
                  #{t}
                </Badge>
              ))}
            </div>
          )}

          <p
            className="mt-[10px] whitespace-pre-line text-[14px] leading-relaxed"
            style={{ color: "var(--foreground-90)" }}
          >
            {shown}
          </p>
          {isLong && (
            <button
              type="button"
              onClick={() => setExpanded((v) => !v)}
              className="mt-[6px] text-[12px] font-semibold transition-opacity hover:opacity-80"
              style={{ color: "var(--accent)" }}
            >
              {expanded ? t("components.postCard.collapse") : t("components.postCard.readMore")}
            </button>
          )}
        </div>

        {/* Media */}
        {(post.video || post.image || (post.images?.length ?? 0) > 0 || (post.mediaItems?.length ?? 0) > 0) && (
          <PostMediaBlock post={post} />
        )}

        {/* Footer actions */}
        <footer
          className="flex items-center gap-[2px] px-[8px] pb-[8px] pt-[4px]"
          style={{ color: "var(--foreground-70)" }}
        >
          <button
            onClick={toggleLike}
            disabled={!canInteract}
            className={actionCls}
            style={{ color: liked ? "var(--accent)" : "var(--foreground-70)" }}
            aria-label={t("components.postCard.likeAria")}
            aria-disabled={!canInteract}
          >
            <motion.span
              key={liked ? "on" : "off"}
              whileTap={{ scale: 1.5 }}
              animate={liked ? { scale: [1, 1.35, 1] } : { scale: 1 }}
              transition={{ type: "spring", stiffness: 480, damping: 14 }}
            >
              <Heart className="h-[16px] w-[16px]" fill={liked ? "currentColor" : "none"} />
            </motion.span>
            <AnimatePresence mode="popLayout" initial={false}>
              <motion.span
                key={likes}
                className="tabular-nums"
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -6, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {likes}
              </motion.span>
            </AnimatePresence>
          </button>

          <button
            onClick={toggleComments}
            disabled={!canInteract && commentsCount === 0}
            className={actionCls}
            style={{ color: "var(--foreground-70)" }}
            aria-label={t("components.postCard.commentsAria")}
            aria-disabled={!canInteract && commentsCount === 0}
          >
            <MessageCircle className="h-[16px] w-[16px]" />
            <span className="tabular-nums">{commentsCount}</span>
          </button>

          <RepostMenu postId={post.id} reposted={reposted} count={reposts} onRepost={toggleRepost} disabled={!canInteract} />

          <button
            onClick={toggleSave}
            disabled={!canInteract}
            className={actionCls}
            style={{ color: saved ? "var(--accent)" : "var(--foreground-70)" }}
            aria-label={t("components.postCard.saveAria")}
            aria-disabled={!canInteract}
          >
            <motion.span
              whileTap={{ scale: 1.3 }}
              transition={{ type: "spring", stiffness: 500, damping: 14 }}
            >
              <Bookmark className="h-[16px] w-[16px]" fill={saved ? "currentColor" : "none"} />
            </motion.span>
            {saves > 0 && <span className="tabular-nums">{saves}</span>}
          </button>

          {/* Views — desktop only */}
          <div
            className="ml-auto hidden items-center gap-[6px] pr-[8px] text-[12px] sm:flex"
            style={{ color: "var(--foreground-50)" }}
          >
            <Eye className="h-[14px] w-[14px]" />
            <span className="tabular-nums">{post.views?.toLocaleString("ru-RU") ?? 0}</span>
          </div>
        </footer>

        <div ref={commentsRef}>
          <CommentSection
            comments={commentList}
            onAdd={addComment}
            loading={commentsFetchStarted && !commentsFetched}
            readOnly={!canInteract}
            previewLimit={3}
            showAll={showAllComments}
            onShowAll={() => {
              setShowAllComments(true);
              startCommentsFetch();
            }}
            totalCount={commentsCount}
          />
        </div>
      </Card>

      <SchedulePostDialog
        post={post}
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onUpdated={(updated) => onTogglePost?.(post.id, { scheduledAt: updated.scheduledAt, date: updated.date })}
      />
    </motion.div>
  );
}
