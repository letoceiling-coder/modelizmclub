import { useEffect, useRef, useState, useCallback, type ReactNode } from "react";
import { motion } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Clock, Check, Radio, Repeat2 } from "lucide-react";
import type { Post, Comment, Community } from "@/lib/mock";
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
import {
  appendToCommentThread,
  replaceInCommentThread,
  removeFromCommentThread,
} from "@/lib/comment-thread";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { CommentSection } from "@/components/post/CommentSection";
import { PostMedia } from "@/components/post/PostMedia";
import { PostHeader } from "@/components/post/PostHeader";
import { PostActions } from "@/components/post/PostActions";
import { EditPostDialog } from "@/components/post/EditPostDialog";
import { PostActionMenu } from "@/components/post/PostActionMenu";
import { SchedulePostDialog } from "@/components/feed/SchedulePostDialog";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { levelFromAccessTier, useGate } from "@/lib/gate";
import { resolveMinTier } from "@/lib/feed-guest-access/store";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import { Link, useNavigate } from "@tanstack/react-router";
import { setChannelSubscription, type Channel } from "@/lib/channels";
import { Button } from "@/components/ui/button";
import { RepostComposerDialog } from "@/components/feed/RepostComposerDialog";
import { formatDate } from "@/lib/format/date";
import { Img } from "@/components/ui/Img";

export type PostCardVariant = "feed" | "community" | "channel" | "profile" | "embedded";

export interface PostCardContext {
  community?: Pick<Community, "id" | "name">;
  channel?: Pick<Channel, "slug" | "name" | "commentsEnabled" | "reactionsEnabled">;
}

export interface PostCardOverrides {
  /** Replace the default reaction request (channel posts react through their own endpoint). */
  toggleLike?: (next: boolean) => Promise<unknown>;
  /** Replace the default delete request; the menu still confirms and reports. */
  remove?: () => Promise<unknown>;
}

interface Props {
  post: Post;
  /**
   * feed — full card with the context line; community — no context line;
   * channel — reactions only when the channel allows them; profile — like
   * feed; embedded — the original inside a repost: no chrome, no actions,
   * the whole block links to the post.
   */
  variant?: PostCardVariant;
  context?: PostCardContext;
  /** Extra chips in the header next to the author (channel: pinned, kind, status). */
  badges?: ReactNode;
  /** Extra block under the text (channel: rejection reason). */
  extras?: ReactNode;
  overrides?: PostCardOverrides;
  /** Shows "Редактировать" in the ⋯ menu and opens the inline title/text editor. */
  onEdited?: (post: Post) => void;
  onTogglePost?: (id: string, patch: Partial<Post>) => void;
  isSavedExternal?: boolean;
  onToggleSave?: (id: string) => void;
  onDelete?: (id: string) => void;
  onHide?: (id: string) => void;
  /** Fired after a successful share/undo so a wrapper card can leave the list. */
  onRepostedChange?: (on: boolean) => void;
  /** First card in the feed — its media is the LCP candidate: loads eagerly with fetchpriority=high. */
  priority?: boolean;
}

export function PostCard({
  post,
  variant = "feed",
  context,
  badges,
  extras,
  overrides,
  onEdited,
  isSavedExternal,
  onToggleSave,
  onDelete,
  onHide,
  onTogglePost,
  onRepostedChange,
  priority = false,
}: Props) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useCurrentUser();
  const author = userById(post.authorId);
  const isShare = variant !== "embedded" && Boolean(post.repostOf);
  const isStaff = me.role === "admin" || me.role === "moderator" || !!me.isAdmin;
  const canDelete =
    variant === "embedded" ? false : post.canDelete || post.authorId === me.id || isStaff;

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
  const [commentsFetchStarted, setCommentsFetchStarted] = useState(
    (post.commentList?.length ?? 0) > 0,
  );
  const [commentsFetched, setCommentsFetched] = useState((post.commentList?.length ?? 0) > 0);
  const [commentSort, setCommentSort] = useState<CommentSort>("interesting");
  const commentsReq = useRef(0);
  const [scheduleDialogOpen, setScheduleDialogOpen] = useState(false);
  const [repostComposerOpen, setRepostComposerOpen] = useState(false);
  const { requirePremium, isAllowed, config: accessConfig } = useGuestAccess();
  const gate = useGate();
  // Required rung per action comes from the admin's guest-access config
  // (guest | auth | subscription); the gate turns it into one window.
  const levelFor = (actionKey: string) =>
    levelFromAccessTier(resolveMinTier(actionKey, accessConfig));
  const commentsEnabled =
    post.channel?.commentsEnabled !== false && context?.channel?.commentsEnabled !== false;
  const reactionsEnabled =
    variant === "channel" ? context?.channel?.reactionsEnabled !== false : true;
  const showContextLine = variant === "feed" || variant === "profile";
  const [editOpen, setEditOpen] = useState(false);
  const [channelSubscribed, setChannelSubscribed] = useState(Boolean(post.channel?.isSubscribed));
  const isScheduled = post.status === "scheduled";
  const canInteract = post.canInteract ?? post.status === "published";
  const [mediaPost, setMediaPost] = useState(post);

  useEffect(() => {
    setMediaPost(post);
  }, [post.id]);

  useEffect(() => {
    const needsPoll = (items: Post["mediaItems"]) =>
      (items ?? []).some(
        (m) => m.type === "video" && m.status !== "failed" && (m.status === "pending" || !m.url),
      );
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

  const loadComments = useCallback(
    (sort: CommentSort, all: boolean) => {
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
    },
    [post.id],
  );

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
    (overrides?.toggleLike ? overrides.toggleLike(next) : reactToPost(post.id, next)).catch(() => {
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

  const sharePost = async () => {
    const url = `${window.location.origin}/feed?post=${post.id}`;
    try {
      if (typeof navigator !== "undefined" && navigator.share) {
        await navigator.share({
          title: post.title || "МоДелизМ",
          text: post.text.slice(0, 120),
          url,
        });
        return;
      }
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      toast.error("Не удалось поделиться");
    }
  };

  const addComment = (
    text: string,
    parentId?: string,
    photos?: { mediaIds: string[]; urls: string[] },
  ) => {
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
        variant === "embedded"
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
      <PostHeader
        author={author}
        authorHref={authorHref}
        authorActionKey={authorActionKey}
        post={post}
        isScheduled={isScheduled}
        showContext={!isShare && showContextLine}
        badges={badges}
      >
        {variant !== "embedded" && (
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
            onEdit={onEdited ? () => setEditOpen(true) : undefined}
            removeOverride={overrides?.remove}
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
      </PostHeader>

      {!isShare && post.channel && variant !== "channel" && (
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
              <Img
                src={post.channel.avatar}
                width={32}
                height={32}
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
              <div
                className="truncate text-[13px] font-semibold"
                style={{ color: "var(--foreground)" }}
              >
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
            <strong style={{ color: "var(--foreground)" }}>
              {formatScheduledAt(post.scheduledAt, defaultScheduleTimezone())}
            </strong>
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
                variant="embedded"
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
              variant === "embedded"
                ? () => navigate({ to: "/feed", search: { post: post.id } })
                : undefined
            }
            role={variant === "embedded" ? "link" : undefined}
            style={variant === "embedded" ? { cursor: "pointer" } : undefined}
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

          {extras}

          {/* Media */}
          {(post.video ||
            post.image ||
            (post.images?.length ?? 0) > 0 ||
            (post.mediaItems?.length ?? 0) > 0) && (
            <PostMedia post={mediaPost} priority={priority} />
          )}

          {/* Footer actions */}
          <PostActions
            post={post}
            liked={liked}
            likes={likes}
            saved={saved}
            saves={saves}
            reposted={reposted}
            reposts={reposts}
            commentsCount={commentsCount}
            commentsEnabled={commentsEnabled}
            reactionsEnabled={reactionsEnabled}
            canInteract={canInteract}
            levelFor={levelFor}
            onLike={doLike}
            onSave={doSave}
            onComments={toggleComments}
            onRepost={toggleRepost}
            onShare={sharePost}
          />

          {commentsEnabled && (
            <div ref={commentsRef}>
              <CommentSection
                comments={commentList}
                onAdd={addComment}
                loading={commentsFetchStarted && !commentsFetched}
                readOnly={!canInteract}
                can={post.can}
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
      {variant === "embedded" ? (
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
      {onEdited && (
        <EditPostDialog
          post={post}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={(next) => {
            onEdited(next);
            setEditOpen(false);
          }}
        />
      )}
      <SchedulePostDialog
        post={post}
        open={scheduleDialogOpen}
        onOpenChange={setScheduleDialogOpen}
        onUpdated={(updated) =>
          onTogglePost?.(post.id, { scheduledAt: updated.scheduledAt, date: updated.date })
        }
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
