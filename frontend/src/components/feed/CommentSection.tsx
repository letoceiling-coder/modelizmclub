import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Reply, Send, MoreHorizontal, ChevronDown } from "lucide-react";
import type { Comment } from "@/lib/mock";
import { userById, formatRelativeTime } from "@/lib/mock";
import { useStore, selectors } from "@/lib/store";
import { cn } from "@/lib/utils";
import { reactToComment } from "@/lib/api/feed";
import { EmojiPicker } from "@/components/messenger/EmojiPicker";
import { ComplaintDialog } from "@/components/friends/ComplaintDialog";
import { useGuestAccessOptional } from "@/components/access/GuestAccessProvider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  comments: Comment[];
  onAdd: (text: string, parentId?: string) => void;
  loading?: boolean;
  readOnly?: boolean;
  /** When set, only the last N root comments are shown until expanded. */
  previewLimit?: number;
  showAll?: boolean;
  onShowAll?: () => void;
  /** Collapses back to the preview. Omit to keep the expanded list open. */
  onHide?: () => void;
  totalCount?: number;
}

/** Expanded lists grow in chunks so a thread with hundreds of replies
 *  doesn't mount at once and shift the feed. */
const PAGE_SIZE = 20;

type CommentSort = "interesting" | "old" | "new";

function commentTime(c: Comment): number {
  const t = Date.parse(c.time);
  return Number.isFinite(t) ? t : 0;
}

function sortComments(list: Comment[], mode: CommentSort): Comment[] {
  const copy = [...list];
  copy.sort((a, b) => {
    if (mode === "interesting") {
      const byLikes = (b.likes ?? 0) - (a.likes ?? 0);
      if (byLikes !== 0) return byLikes;
      return commentTime(b) - commentTime(a);
    }
    if (mode === "old") return commentTime(a) - commentTime(b);
    return commentTime(b) - commentTime(a);
  });
  return copy;
}

function CommentSkeleton() {
  return (
    <div className="mt-[12px] space-y-[12px]" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-[10px]">
          <div className="h-[32px] w-[32px] shrink-0 animate-pulse rounded-full" style={{ background: "var(--background-surface)" }} />
          <div className="min-w-0 flex-1">
            <div className="h-[52px] w-full animate-pulse rounded-[12px]" style={{ background: "var(--background-surface)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentAvatar({ authorId, name }: { authorId: string; name: string }) {
  const author = userById(authorId);
  const src = author.avatar;
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";
  if (!src) {
    return (
      <div
        className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full text-[11px] font-bold text-white"
        style={{ background: "var(--accent)" }}
        aria-hidden
      >
        {initials}
      </div>
    );
  }
  return <img src={src} alt={name} className="h-[32px] w-[32px] shrink-0 rounded-full object-cover" />;
}

function runGuarded(
  guest: ReturnType<typeof useGuestAccessOptional>,
  actionKey: string,
  onAllowed: () => void,
) {
  if (guest) guest.guardAction(actionKey, onAllowed);
  else onAllowed();
}

function CommentItem({
  comment,
  depth = 0,
  onReply,
  readOnly = false,
}: {
  comment: Comment;
  depth?: number;
  onReply: (parentId: string, text: string) => void;
  readOnly?: boolean;
}) {
  const { t } = useTranslation();
  const guest = useGuestAccessOptional();
  const me = useStore(selectors.currentUser);
  const author = userById(comment.authorId);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(comment.likes ?? 0);
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const isOwn = comment.authorId === me.id;

  const submit = () => {
    if (!draft.trim()) return;
    runGuarded(guest, "feed.post.comment", () => {
      onReply(comment.id, draft.trim());
      setDraft("");
      setReplying(false);
    });
  };

  const toggleLike = () => {
    runGuarded(guest, "feed.post.like", () => {
      const next = !liked;
      setLiked(next);
      setLikes((n) => n + (next ? 1 : -1));
      reactToComment(comment.id, next).catch(() => {
        setLiked(!next);
        setLikes((n) => n + (next ? -1 : 1));
      });
    });
  };

  return (
    <>
      <div className="flex gap-[10px]" style={{ marginLeft: depth > 0 ? 36 : 0 }}>
        <CommentAvatar authorId={comment.authorId} name={author.name} />
        <div className="min-w-0 flex-1">
          <div
            className="rounded-[12px] px-[12px] py-[8px]"
            style={{ background: "var(--background-surface)" }}
          >
            <div className="flex items-start gap-[8px]">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-[8px]">
                  <span className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                    {author.name}
                  </span>
                  <span className="text-[11px]" style={{ color: "var(--foreground-50)" }}>
                    {formatRelativeTime(comment.time)}
                  </span>
                </div>
                <p className="mt-[4px] whitespace-pre-line text-[14px]" style={{ color: "var(--foreground-90)" }}>
                  {comment.text}
                </p>
              </div>
              {!isOwn && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[8px] hover:bg-[var(--background-elevated)]"
                      style={{ color: "var(--foreground-50)" }}
                      aria-label={t("components.commentSection.actions")}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => runGuarded(guest, "feed.post.comment", () => setReportOpen(true))}>
                      {t("components.commentSection.report")}
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </div>
          </div>
          <div className="mt-[6px] flex items-center gap-[12px] pl-[4px] text-[12px]" style={{ color: "var(--foreground-70)" }}>
            <button
              type="button"
              onClick={toggleLike}
              className="flex items-center gap-[4px] transition-colors"
              style={{ color: liked ? "var(--accent)" : "var(--foreground-70)" }}
            >
              <motion.span whileTap={{ scale: 1.4 }} transition={{ type: "spring", stiffness: 500, damping: 12 }}>
                <Heart className="h-[12px] w-[12px]" fill={liked ? "currentColor" : "none"} />
              </motion.span>
              {likes > 0 && <span>{likes}</span>}
            </button>
            {!readOnly && depth < 1 && (
              <button
                type="button"
                onClick={() => runGuarded(guest, "feed.post.comment", () => setReplying((v) => !v))}
                className="flex items-center gap-[4px] hover:opacity-80"
              >
                <Reply className="h-[12px] w-[12px]" /> {t("components.commentSection.reply")}
              </button>
            )}
          </div>

          <AnimatePresence>
            {!readOnly && replying && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                transition={{ duration: 0.2 }}
                className="mt-[8px] overflow-hidden"
              >
                <div className="flex items-center gap-[8px]">
                  <input
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    onKeyDown={(e) => e.key === "Enter" && submit()}
                    placeholder={t("components.commentSection.replyTo", { name: author.name })}
                    className="flex-1 rounded-[10px] border px-[12px] py-[8px] text-[13px] outline-none"
                    style={{
                      background: "var(--background)",
                      borderColor: "var(--border)",
                      color: "var(--foreground)",
                    }}
                    autoFocus
                  />
                  <button
                    type="button"
                    onClick={submit}
                    className="grid h-[34px] w-[34px] place-items-center rounded-[10px]"
                    style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                  >
                    <Send className="h-[14px] w-[14px]" />
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-[10px] space-y-[10px]">
              {comment.replies.map((r) => (
                <CommentItem key={r.id} comment={r} depth={depth + 1} onReply={onReply} readOnly={readOnly} />
              ))}
            </div>
          )}
        </div>
      </div>

      <ComplaintDialog
        target={reportOpen ? author : null}
        onClose={() => setReportOpen(false)}
        page="/feed"
        subjectSuffix={t("components.commentSection.reportSuffix")}
        contextNote={comment.text}
        report={{ type: "comment", targetId: comment.id }}
        descriptionOverride={t("components.commentSection.reportDesc")}
      />
    </>
  );
}

export function CommentSection({
  comments,
  onAdd,
  loading,
  readOnly = false,
  previewLimit = 3,
  showAll = false,
  onShowAll,
  onHide,
  totalCount,
}: Props) {
  const { t } = useTranslation();
  const guest = useGuestAccessOptional();
  const me = useStore(selectors.currentUser);
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<CommentSort>("interesting");

  useEffect(() => {
    if (!showAll) setPage(1);
  }, [showAll]);

  const handleReply = (parentId: string, text: string) => onAdd(text, parentId);

  const submit = () => {
    runGuarded(guest, "feed.post.comment", () => {
      if (!draft.trim()) return;
      onAdd(draft.trim());
      setDraft("");
    });
  };

  const commentBlocked = guest ? !guest.isAllowed("feed.post.comment") : false;

  const promptComposerAuth = (e: { preventDefault: () => void }) => {
    if (!commentBlocked) return;
    e.preventDefault();
    guest?.guardAction("feed.post.comment", () => {});
  };

  const sortedComments = useMemo(() => sortComments(comments, sort), [comments, sort]);

  const visibleComments = useMemo(() => {
    if (showAll) return sortedComments.slice(0, page * PAGE_SIZE);
    if (previewLimit <= 0 || sortedComments.length <= previewLimit) return sortedComments;
    return sortedComments.slice(0, previewLimit);
  }, [sortedComments, previewLimit, showAll, page]);

  const hiddenCount = Math.max(0, (totalCount ?? comments.length) - visibleComments.length);
  const canLoadMore = showAll && sortedComments.length > visibleComments.length;

  const sortLabel =
    sort === "interesting"
      ? t("components.commentSection.sortInteresting")
      : sort === "old"
        ? t("components.commentSection.sortOld")
        : t("components.commentSection.sortNew");

  return (
    <div
      className="border-t px-[16px] py-[12px]"
      style={{ borderColor: "var(--border)", background: "var(--background-overlay)" }}
    >
      {!readOnly && (
        <div className="flex items-center gap-[10px]">
          <CommentAvatar authorId={me.id} name={me.name} />
          <div
            className="flex min-w-0 flex-1 items-center gap-[6px] rounded-[12px] border px-[10px] py-[6px]"
            style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
          >
            <input
              value={draft}
              readOnly={commentBlocked}
              onPointerDown={promptComposerAuth}
              onFocus={promptComposerAuth}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
              placeholder={t("components.commentSection.placeholder")}
              className="min-w-0 flex-1 bg-transparent py-[4px] text-[14px] outline-none"
              style={{ color: "var(--foreground)" }}
            />
            <EmojiPicker
              onBeforeOpen={() => {
                if (!commentBlocked) return true;
                guest?.guardAction("feed.post.comment", () => {});
                return false;
              }}
              onPick={(emoji) => {
                if (commentBlocked) {
                  guest?.guardAction("feed.post.comment", () => {});
                  return;
                }
                setDraft((v) => v + emoji);
              }}
              align="end"
              compact
            />
            <button
              type="button"
              onClick={submit}
              disabled={!draft.trim()}
              className="grid h-[30px] w-[30px] place-items-center rounded-[10px] transition-opacity disabled:opacity-40"
              style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
              aria-label={t("components.commentSection.send")}
            >
              <Send className="h-[14px] w-[14px]" />
            </button>
          </div>
        </div>
      )}

      {loading && comments.length === 0 ? (
        <CommentSkeleton />
      ) : (
        <>
          {comments.length > 1 && (
            <DropdownMenu modal={false}>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  className="mt-[10px] inline-flex items-center gap-[4px] text-[13px] font-semibold transition-opacity hover:opacity-80"
                  style={{ color: "var(--foreground-70)" }}
                >
                  {sortLabel}
                  <ChevronDown className="h-[14px] w-[14px]" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent
                align="start"
                className="z-[80] min-w-[220px] overflow-hidden rounded-[12px] border p-0"
                style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
              >
                {([
                  ["interesting", t("components.commentSection.sortInteresting")],
                  ["new", t("components.commentSection.sortNew")],
                  ["old", t("components.commentSection.sortOld")],
                ] as const).map(([key, label]) => (
                  <DropdownMenuItem
                    key={key}
                    onSelect={() => setSort(key)}
                    className="cursor-pointer rounded-none px-[14px] py-[10px] text-[13px]"
                    style={{ color: sort === key ? "var(--accent)" : "var(--foreground)" }}
                  >
                    {label}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          )}
          {canLoadMore && (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="mt-[10px] text-[13px] font-semibold transition-opacity hover:opacity-80"
              style={{ color: "var(--accent)" }}
            >
              {t("components.commentSection.loadMore")}
            </button>
          )}
          {visibleComments.length > 0 && (
            <div className={cn(!readOnly ? "mt-[12px]" : "", "space-y-[12px]")}>
              {visibleComments.map((c) => (
                <CommentItem key={c.id} comment={c} onReply={handleReply} readOnly={readOnly} />
              ))}
            </div>
          )}
        </>
      )}

      {!showAll && hiddenCount > 0 && onShowAll && (
        <button
          type="button"
          onClick={onShowAll}
          className="mt-[10px] text-[13px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          {t("components.commentSection.viewAll", { count: totalCount ?? comments.length })}
        </button>
      )}

      {showAll && onHide && comments.length > previewLimit && (
        <button
          type="button"
          onClick={onHide}
          className="mt-[10px] text-[13px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          {t("components.commentSection.hide")}
        </button>
      )}
    </div>
  );
}
