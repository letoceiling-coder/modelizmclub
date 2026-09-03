import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Heart, MessageCircle, Bookmark, Eye, Clock, Check, Radio, Loader2, AlertTriangle, Repeat2 } from "lucide-react";
import type { Post, Comment } from "@/lib/mock";
import { userById } from "@/lib/mock";
import { useCurrentUser } from "@/lib/session";
import {
  reactToPost,
  bookmarkPost,
  repostPost,
  fetchPostComments,
  fetchAllPostComments,
  createComment,
  publishPost,
  cancelScheduledPost,
  fetchPost,
  type CommentSort,
} from "@/lib/api/feed";
import { formatScheduledAt, defaultScheduleTimezone } from "@/lib/post-schedule";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { appendToCommentThread, replaceInCommentThread, removeFromCommentThread } from "@/lib/comment-thread";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { CommentSection } from "@/components/feed/CommentSection";
import { PostMediaCarousel } from "@/components/feed/PostMediaCarousel";
import { FeedMediaGrid } from "@/components/feed/FeedMediaGrid";
import { RepostMenu } from "@/components/feed/RepostMenu";
import { PostActionMenu } from "@/components/post/PostActionMenu";
import { SchedulePostDialog } from "@/components/feed/SchedulePostDialog";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { Gated, levelFromAccessTier, useGate } from "@/lib/gate";
import { resolveMinTier } from "@/lib/feed-guest-access/store";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import { Link, useNavigate } from "@tanstack/react-router";
import { setChannelSubscription } from "@/lib/channels";
import { Button } from "@/components/ui/button";
import { RepostComposerDialog } from "@/components/feed/RepostComposerDialog";
import { formatDate } from "@/lib/format/date";

interface Props {
  post: Post;
  onTogglePost?: (id: string, patch: Partial<Post>) => void;
  isSavedExternal?: boolean;
  onToggleSave?: (id: string) => void;
  onDelete?: (id: string) => void;
  onHide?: (id: string) => void;
  /** Inner original card inside a share — no outer chrome, actions hit the original. */
  variant?: "full" | "embed";
  /** Fired after a successful share/undo so a wrapper card can leave the list. */
  onRepostedChange?: (on: boolean) => void;
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

/** Media block: VK grid for images-only; carousel when video is present. */
function VideoProcessingFrame({ failed }: { failed: boolean }) {
  const { t } = useTranslation();
  return (
    <div
      className="flex aspect-video w-full flex-col items-center justify-center gap-[10px] px-[16px] text-center"
      style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}
    >
      {failed ? (
        <AlertTriangle className="h-[22px] w-[22px]" style={{ color: "var(--destructive, #d94b4b)" }} />
      ) : (
        <Loader2 className="h-[22px] w-[22px] animate-spin" style={{ color: "var(--accent)" }} />
      )}
      <p className="text-[13px] font-medium">
        {failed ? t("components.postCard.videoFailed") : t("components.postCard.videoProcessing")}
      </p>
    </div>
  );
}

function PostMediaBlock({ post }: { post: Post }) {
  const items =
    post.mediaItems ??
    [
      ...(post.video ? [{ type: "video" as const, url: post.video }] : []),
      ...(post.images?.length ? post.images.map((url) => ({ type: "image" as const, url })) : post.image ? [{ type: "image" as const, url: post.image }] : []),
    ];

  if (items.length === 0) return null;

  const videoSlide = items.find((item) => item.type === "video");
  if (videoSlide && (videoSlide.status === "pending" || videoSlide.status === "failed" || !videoSlide.url)) {
    return <VideoProcessingFrame failed={videoSlide.status === "failed"} />;
  }

  const hasVideo = items.some((item) => item.type === "video");
  if (hasVideo) {
    return <PostMediaCarousel items={items} alt={post.title} />;
  }

  const imageItems = items
    .filter((item) => item.type === "image")
    .map((item) => ({ url: item.url, variants: item.variants }));
  return <FeedMediaGrid images={imageItems} alt={post.title} />;
}

/** Shared class for footer action buttons — ghost-style, accent hover */
const actionCls =
  "inline-flex items-center gap-[6px] rounded-[10px] px-[10px] py-[7px] text-[13px] font-medium transition-colors hover:bg-[var(--accent-soft)] disabled:pointer-events-none disabled:opacity-45";

export function PostCard({ post, isSavedExternal, onToggleSave, onDelete, onHide, onTogglePost, variant = "full", onRepostedChange }: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useCurrentUser();
  const author = userById(post.authorId);
  const isShare = variant === "full" && Boolean(post.repostOf);
  const isStaff = me.role === "admin" || me.role === "moderator" || !!me.isAdmin;
  const canDelete = variant === "embed" ? false : post.canDelete || post.authorId === me.id || isStaff;

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
  const [commentSort, setCommentSort] = useState<CommentSort>("interesting");
  const commentsReq = useRef(0);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [repostComposerOpen, setRepostComposerOpen] = useState(false);
  const { requirePremium, isAllowed, config: accessConfig } = useGuestAccess();
  const gate = useGate();
  // Required rung per action comes from the admin's guest-access config
  // (guest | auth | subscription); the gate turns it into one window.
  const levelFor = (actionKey: string) => levelFromAccessTier(resolveMinTier(actionKey, accessConfig));
  const commentsEnabled = post.channel?.commentsEnabled !== false;
  const [channelSubscribed, setChannelSubscribed] = useState(Boolean(post.channel?.isSubscribed));
  const isScheduled = post.status === "scheduled";
  const canInteract = post.canInteract ?? post.status === "published";
  const [mediaPost, setMediaPost] = useState(post);

  useEffect(() => {
    setMediaPost(post);
  }, [post.id]);

  useEffect(() => {
    const needsPoll = (items: Post["mediaItems"]) =>
      (items ?? []).some((m) => m.type === "video" && m.status !== "failed" && (m.status === "pending" || !m.url));
    if (!needsPoll(post.mediaItems)) return;
    let cancelled = false;
    let attempts = 0;
    let timer = 0;
    const tick = () => {
      attempts += 1;
      void fetchPost(post.id)
        .then((next) => {
          if (cancelled) return;
          setMediaPost(next);
          onTogglePost?.(post.id, {
            mediaItems: next.mediaItems,
            video: next.video,
            images: next.images,
            image: next.image,
          });
          if (needsPoll(next.mediaItems) && attempts < 40) {
            timer = window.setTimeout(tick, 3000);
          }
        })
        .catch(() => {
          if (!cancelled && attempts < 40) timer = window.setTimeout(tick, 4000);
        });
    };
    timer = window.setTimeout(tick, 2500);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // Poller is keyed to this post; mediaItems live on the first snapshot.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [post.id]);
  const hasCommentsHint = (post.comments ?? 0) > 0 || (post.commentList?.length ?? 0) > 0;

  const loadComments = useCallback((sort: CommentSort, all: boolean) => {
    setCommentsFetchStarted(true);
    const n = ++commentsReq.current;
    const req = all
      ? fetchAllPostComments(post.id, sort)
      : fetchPostComments(post.id, { sort, perPage: 50 });
    req
      .then((list) => {
        if (n !== commentsReq.current) return;
        setCommentList(list);
        setCommentsFetched(true);
      })
      .catch(() => {
        if (n !== commentsReq.current) return;
        setCommentsFetched(true);
      });
  }, [post.id]);

  const startCommentsFetch = useCallback(() => {
    if (commentsFetchStarted) return;
    loadComments(commentSort, showAllComments);
  }, [commentsFetchStarted, loadComments, commentSort, showAllComments]);

  useEffect(() => {
    if (isShare) return;
    if (hasCommentsHint || canInteract) startCommentsFetch();
  }, [hasCommentsHint, canInteract, startCommentsFetch, isShare]);

  const text = post.text ?? "";
  const isLong = text.length > 220;
  const shown = !isLong || expanded ? text : text.slice(0, 220) + "…";
  const commentsCount =
    commentList.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0) || post.comments;

  const focusComments = () => {
    commentsRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    const input = commentsRef.current?.querySelector("input");
    if (input instanceof HTMLInputElement) input.focus();
  };

  const toggleComments = () => {
    if (showAllComments) {
      commentsRef.current?.scrollIntoView({ block: "nearest", behavior: "smooth" });
      return;
    }
    if (commentsCount > 3) {
      setShowAllComments(true);
      loadComments(commentSort, true);
      return;
    }
    if (!canInteract && commentsCount === 0) return;
    // Viewing comments is open; SMS/login gate fires when focusing the composer.
    focusComments();
  };

  // Bodies run only once the gate lets them through (see the <Gated> wrappers
  // in the footer and gate.require() below).
  const doLike = () => {
    if (!canInteract) return;
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    reactToPost(post.id, next).catch(() => {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    });
  };
  const doSave = () => {
    if (!canInteract) return;
    const next = !saved;
    if (onToggleSave) onToggleSave(post.id);
    else setSavedInner((v) => !v);
    setSaves((n) => n + (next ? 1 : -1));
    bookmarkPost(post.id, next).catch(() => {
      if (!onToggleSave) setSavedInner((v) => !v);
      setSaves((n) => n + (next ? -1 : 1));
    });
  };
  // Gated form of doSave for children that take a plain callback (embedded card).
  const toggleSave = () => {
    void gate.require(levelFor("feed.post.save"), doSave);
  };
  const toggleRepost = () => {
    if (!canInteract || isScheduled) return;
    void gate.require(levelFor("feed.post.repost"), () => {
      if (reposted) {
        const next = false;
        setReposted(next);
        setReposts((n) => Math.max(0, n - 1));
        toast.success(t("components.repostMenu.repostUndone"));
        repostPost(post.id, false)
          .then(() => onRepostedChange?.(false))
          .catch(() => {
            setReposted(true);
            setReposts((n) => n + 1);
            toast.error(t("components.repostMenu.repostFailed"));
          });
        return;
      }
      setRepostComposerOpen(true);
    });
  };

  const confirmRepost = (body: string) => {
    setReposted(true);
    setReposts((n) => n + 1);
    toast.success(t("components.repostMenu.repostAdded"));
    repostPost(post.id, true, body)
      .then(() => onRepostedChange?.(true))
      .catch(() => {
        setReposted(false);
        setReposts((n) => Math.max(0, n - 1));
        toast.error(t("components.repostMenu.repostFailed"));
      });
  };

  const addComment = (text: string, parentId?: string, photos?: { mediaIds: string[]; urls: string[] }) => {
    if (!canInteract) return;
    void gate.require(levelFor("feed.post.comment"), () => {
      const tempId = `nc${Date.now()}`;
      const newC: Comment = {
        id: tempId,
        authorId: me.id,
        time: new Date().toISOString(),
        text,
        likes: 0,
        replies: [],
        images: photos?.urls ?? [],
      };
      setCommentList((list) => {
        if (!parentId) return [...list, newC];
        return appendToCommentThread(list, parentId, newC);
      });
      createComment(post.id, text, parentId, photos?.mediaIds)
        .then((saved) => {
          setCommentList((list) => replaceInCommentThread(list, parentId, tempId, saved));
        })
        .catch(() => {});
    });
  };

  const profileTo = author.slug ?? author.id;
  const authorHref = `/user/${profileTo}`;
  const authorActionKey = !isAllowed("feed.post.author") ? "feed.post.author" : "route.user";

  const shell = (
      <Card
        className={cn(
          "overflow-hidden border-[var(--border)]",
          variant === "embed"
            ? "rounded-none border-0 shadow-none"
            : "rounded-none shadow-[var(--shadow-card)] sm:rounded-[var(--r-card)]",
        )}
      >
        {isShare && (
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
              <GuestGuardLink
                actionKey={authorActionKey}
                to={authorHref}
                style={{ color: "var(--foreground)", fontWeight: 600 }}
                className="hover:underline"
              >
                {author.name}
              </GuestGuardLink>{" "}
              {t("components.postCard.sharedPost")}
            </span>
          </div>
        )}

        {/* Header */}
        <header className="flex items-center gap-[12px] px-[16px] pt-[16px]">
          <GuestGuardLink actionKey={authorActionKey} to={authorHref} className="shrink-0">
            <AuthorAvatar src={author.avatar} name={author.name} />
          </GuestGuardLink>
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[8px]">
              <GuestGuardLink
                actionKey={authorActionKey}
                to={authorHref}
                className="truncate text-[14px] font-semibold hover:underline"
                style={{ color: "var(--foreground)" }}
              >
                {author.name}
              </GuestGuardLink>
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
                : formatDate(post.date, "relative")}
              {!isShare && post.category ? (
                <>
                  {" · "}
                  <span>{post.category}</span>
                </>
              ) : null}
            </div>
          </div>
          {variant !== "embed" && (
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
          )}
        </header>

        {!isShare && post.channel && (
          <div
            className="mx-[16px] mt-[12px] flex items-center gap-[10px] rounded-[12px] border px-[12px] py-[8px]"
            style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
          >
            <Link
              to="/channel/$id"
              params={{ id: post.channel.slug }}
              className="flex min-w-0 flex-1 items-center gap-[10px]"
            >
              {post.channel.avatar ? (
                <img
                  src={post.channel.avatar}
                  alt=""
                  className="h-8 w-8 shrink-0 rounded-[8px] object-cover"
                />
              ) : (
                <div
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-[8px]"
                  style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                >
                  <Radio size={14} />
                </div>
              )}
              <div className="min-w-0">
                <div className="truncate text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {post.channel.name}
                </div>
                <div className="text-[11px]" style={{ color: "var(--foreground-50)" }}>
                  {t("components.postCard.channelPlaque")}
                </div>
              </div>
            </Link>
            <Button
              type="button"
              size="sm"
              variant={channelSubscribed ? "outline" : "default"}
              className="shrink-0 rounded-[10px] gap-1"
              onClick={() => {
                requirePremium(() => {
                  const next = !channelSubscribed;
                  setChannelSubscribed(next);
                  void setChannelSubscription(post.channel!.slug, next).catch(() => {
                    setChannelSubscribed(!next);
                    toast.error(t("pages.channelDetail.subscribeFailed"));
                  });
                });
              }}
            >
              {channelSubscribed ? (
                <>
                  <Check size={14} /> {t("pages.shared.youSubscribed")}
                </>
              ) : (
                t("pages.shared.subscribe")
              )}
            </Button>
          </div>
        )}

        {!isShare && isScheduled && post.scheduledAt && (
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

        {isShare ? (
          <>
            {post.text.trim() !== "" && (
              <div className="px-[16px] pb-[12px] pt-[12px]">
                <p
                  className="whitespace-pre-line text-[14px] leading-relaxed"
                  style={{ color: "var(--foreground-90)" }}
                >
                  {post.text}
                </p>
              </div>
            )}
            {post.repostOf && (
              <div
                className="mx-[16px] mb-[16px] mt-[12px] overflow-hidden rounded-[12px] border"
                style={{ borderColor: "var(--border)" }}
              >
                <PostCard
                  variant="embed"
                  post={post.repostOf}
                  onRepostedChange={(on) => {
                    if (!on) onDelete?.(post.id);
                  }}
                />
              </div>
            )}
          </>
        ) : (
          <>
        {/* Content */}
        <div
          className="px-[16px] pb-[12px] pt-[12px]"
          onClick={
            variant === "embed"
              ? () => navigate({ to: "/feed", search: { post: post.id } })
              : undefined
          }
          role={variant === "embed" ? "link" : undefined}
          style={variant === "embed" ? { cursor: "pointer" } : undefined}
        >
          {post.title ? (
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
          ) : null}

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

          {post.text ? (
          <p
            className="mt-[10px] whitespace-pre-line text-[14px] leading-relaxed"
            style={{ color: "var(--foreground-90)" }}
          >
            {shown}
          </p>
          ) : null}
          {isLong && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                setExpanded((v) => !v);
              }}
              className="mt-[6px] text-[12px] font-semibold transition-opacity hover:opacity-80"
              style={{ color: "var(--accent)" }}
            >
              {expanded ? t("components.postCard.collapse") : t("components.postCard.readMore")}
            </button>
          )}
        </div>

        {/* Media */}
        {(post.video || post.image || (post.images?.length ?? 0) > 0 || (post.mediaItems?.length ?? 0) > 0) && (
          <PostMediaBlock post={mediaPost} />
        )}

        {/* Footer actions */}
        <footer
          className="flex items-center gap-[2px] px-[8px] pb-[8px] pt-[4px]"
          style={{ color: "var(--foreground-70)" }}
        >
          <Gated level={levelFor("feed.post.like")} action={doLike} entity={post} actionName="react">
          <button
            type="button"
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
          </Gated>

          <button
            onClick={toggleComments}
            disabled={(!canInteract && commentsCount === 0) || !commentsEnabled}
            className={actionCls}
            style={{ color: "var(--foreground-70)" }}
            aria-label={t("components.postCard.commentsAria")}
            aria-disabled={(!canInteract && commentsCount === 0) || !commentsEnabled}
          >
            <MessageCircle className="h-[16px] w-[16px]" />
            <span className="tabular-nums">{commentsCount}</span>
          </button>

          <RepostMenu postId={post.id} reposted={reposted} count={reposts} onRepost={toggleRepost} disabled={!canInteract} />

          <Gated level={levelFor("feed.post.save")} action={doSave} entity={post}>
          <button
            type="button"
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
          </Gated>

          {/* Views — desktop only */}
          <div
            className="ml-auto hidden items-center gap-[6px] pr-[8px] text-[12px] sm:flex"
            style={{ color: "var(--foreground-50)" }}
          >
            <Eye className="h-[14px] w-[14px]" />
            <span className="tabular-nums">{post.views?.toLocaleString("ru-RU") ?? 0}</span>
          </div>
        </footer>

        {commentsEnabled && (
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
              loadComments(commentSort, true);
            }}
            onHide={() => setShowAllComments(false)}
            totalCount={commentsCount}
            onDeleted={(id) => setCommentList((prev) => removeFromCommentThread(prev, id))}
            onSortChange={(next) => {
              setCommentSort(next);
              loadComments(next, showAllComments);
            }}
          />
        </div>
        )}
          </>
        )}
      </Card>
  );

  return (
    <>
      {variant === "embed" ? (
        shell
      ) : (
        <motion.div
          id={`feed-post-${post.id}`}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
          className="feed-virtual-item"
        >
          {shell}
        </motion.div>
      )}
      <SchedulePostDialog
        post={post}
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onUpdated={(updated) => onTogglePost?.(post.id, { scheduledAt: updated.scheduledAt, date: updated.date })}
      />
      <RepostComposerDialog
        post={post}
        open={repostComposerOpen}
        onOpenChange={setRepostComposerOpen}
        onConfirm={confirmRepost}
      />
    </>
  );
}
