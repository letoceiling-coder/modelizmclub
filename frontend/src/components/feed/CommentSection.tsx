import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Reply, Send, MoreHorizontal, ChevronDown, Paperclip, X } from "lucide-react";
import type { Comment, User } from "@/lib/mock";
import { userById } from "@/lib/mock";
import { useStore, selectors } from "@/lib/store";
import { cn } from "@/lib/utils";
import { reactToComment, deleteComment, type CommentSort } from "@/lib/api/feed";
import { uploadMediaDeduped } from "@/lib/api/media";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { EmojiPicker } from "@/components/messenger/EmojiPicker";
import { ComplaintDialog } from "@/components/friends/ComplaintDialog";
import { useGuestAccessOptional } from "@/components/access/GuestAccessProvider";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate } from "@/lib/format/date";

type CommentPhotosPayload = { mediaIds: string[]; urls: string[] };

interface Props {
  comments: Comment[];
  onAdd: (text: string, parentId?: string, photos?: CommentPhotosPayload) => void;
  onDeleted?: (commentId: string) => void;
  loading?: boolean;
  readOnly?: boolean;
  /** When set, only the last N root comments are shown until expanded. */
  previewLimit?: number;
  showAll?: boolean;
  onShowAll?: () => void;
  /** Collapses back to the preview. Omit to keep the expanded list open. */
  onHide?: () => void;
  totalCount?: number;
  onSortChange?: (sort: CommentSort) => void;
}

/** Expanded lists grow in chunks so a thread with hundreds of replies
 *  doesn't mount at once and shift the feed. */
const PAGE_SIZE = 20;

function commentTime(c: Comment): number {
  const t = Date.parse(c.time);
  return Number.isFinite(t) ? t : 0;
}

function likesOf(c: Comment, overrides: Record<string, number>): number {
  return overrides[c.id] ?? c.likes ?? 0;
}

function sortComments(list: Comment[], mode: CommentSort, overrides: Record<string, number> = {}): Comment[] {
  const copy = list.map((c) => ({
    ...c,
    replies: c.replies?.length ? sortComments(c.replies, mode, overrides) : c.replies,
  }));
  copy.sort((a, b) => {
    if (mode === "interesting") {
      const byLikes = likesOf(b, overrides) - likesOf(a, overrides);
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

function profileHref(user: Pick<User, "id" | "slug">): string {
  return `/user/${user.slug ?? user.id}`;
}

function authorActionKey(guest: ReturnType<typeof useGuestAccessOptional>): string {
  if (guest && !guest.isAllowed("feed.post.author")) return "feed.post.author";
  return "route.user";
}

function CommentAvatar({
  author,
  name,
  actionKey,
}: {
  author: User;
  name: string;
  actionKey: string;
}) {
  const src = author.avatar;
  const initials = name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase() || "?";
  const face = !src ? (
    <div
      className="grid h-[32px] w-[32px] place-items-center rounded-full text-[11px] font-bold text-white"
      style={{ background: "var(--accent)" }}
      aria-hidden
    >
      {initials}
    </div>
  ) : (
    <img src={src} alt="" className="h-[32px] w-[32px] rounded-full object-cover" />
  );
  if (!author.id) return <span className="shrink-0">{face}</span>;
  return (
    <GuestGuardLink
      actionKey={actionKey}
      to={profileHref(author)}
      className="shrink-0 rounded-full hover:opacity-80"
      aria-label={name}
    >
      {face}
    </GuestGuardLink>
  );
}

function runGuarded(
  guest: ReturnType<typeof useGuestAccessOptional>,
  actionKey: string,
  onAllowed: () => void,
) {
  if (guest) guest.guardAction(actionKey, onAllowed);
  else onAllowed();
}

const MAX_COMMENT_PHOTOS = 4;
const COMMENT_PHOTO_MAX = 5_242_880;
const COMMENT_PHOTO_TYPES = new Set(["image/jpeg", "image/png", "image/webp"]);

type PhotoDraft = { file: File; url: string };

function CommentPhotos({ urls }: { urls: string[] }) {
  const [open, setOpen] = useState<string | null>(null);
  if (!urls.length) return null;
  return (
    <>
      <div className="mt-[8px] flex flex-wrap gap-[6px]">
        {urls.map((src) => (
          <button
            key={src}
            type="button"
            onClick={() => setOpen(src)}
            className="overflow-hidden rounded-[10px]"
          >
            <img src={src} alt="" className="max-h-[160px] max-w-[min(100%,220px)] object-cover" />
          </button>
        ))}
      </div>
      {open ? <ImageLightbox src={open} alt="" onClose={() => setOpen(null)} /> : null}
    </>
  );
}

function useCommentPhotoDraft() {
  const { t } = useTranslation();
  const [photos, setPhotos] = useState<PhotoDraft[]>([]);
  const [uploading, setUploading] = useState(false);

  const pick = (list: FileList | null) => {
    if (!list?.length) return;
    const extra: PhotoDraft[] = [];
    for (const file of Array.from(list)) {
      if (photos.length + extra.length >= MAX_COMMENT_PHOTOS) {
        toast.error(t("components.commentSection.photoLimit", { max: MAX_COMMENT_PHOTOS }));
        break;
      }
      if (file.size > COMMENT_PHOTO_MAX) {
        toast.error(t("components.commentSection.photoTooBig"));
        continue;
      }
      if (file.type && !COMMENT_PHOTO_TYPES.has(file.type)) {
        toast.error(t("components.commentSection.photoType"));
        continue;
      }
      extra.push({ file, url: URL.createObjectURL(file) });
    }
    if (extra.length) setPhotos((p) => [...p, ...extra]);
  };

  const remove = (index: number) => {
    setPhotos((p) => {
      const next = [...p];
      URL.revokeObjectURL(next[index].url);
      next.splice(index, 1);
      return next;
    });
  };

  const clear = () => {
    setPhotos((p) => {
      p.forEach((item) => URL.revokeObjectURL(item.url));
      return [];
    });
  };

  const upload = async (): Promise<CommentPhotosPayload> => {
    if (photos.length === 0) return { mediaIds: [], urls: [] };
    setUploading(true);
    try {
      const mediaIds: string[] = [];
      for (const item of photos) {
        const media = await uploadMediaDeduped(item.file, "comment");
        mediaIds.push(media.uuid);
      }
      return { mediaIds, urls: photos.map((item) => item.url) };
    } finally {
      setUploading(false);
    }
  };

  return { photos, uploading, pick, remove, clear, upload };
}

function CommentAttachMenu({
  onPick,
  disabled,
}: {
  onPick: (files: FileList | null) => void;
  disabled?: boolean;
}) {
  const { t } = useTranslation();
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => {
          onPick(e.target.files);
          e.target.value = "";
        }}
      />
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            disabled={disabled}
            className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] transition-opacity hover:opacity-80 disabled:opacity-40"
            style={{ color: "var(--foreground-50)" }}
            aria-label={t("components.commentSection.attachFile")}
          >
            <Paperclip className="h-[15px] w-[15px]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="min-w-[200px]">
          <DropdownMenuItem onSelect={() => inputRef.current?.click()}>
            {t("components.commentSection.attachPhoto")}
          </DropdownMenuItem>
          <DropdownMenuItem disabled>
            {t("components.commentSection.attachFile")}
            <span className="ml-[8px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
              {t("components.commentSection.attachSoon")}
            </span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </>
  );
}

function PhotoDraftStrip({
  photos,
  onRemove,
}: {
  photos: PhotoDraft[];
  onRemove: (index: number) => void;
}) {
  const { t } = useTranslation();
  if (!photos.length) return null;
  return (
    <div className="flex flex-wrap gap-[8px] px-[4px] pt-[8px]">
      {photos.map((item, index) => (
        <div key={item.url} className="relative">
          <img src={item.url} alt="" className="h-[64px] w-[64px] rounded-[10px] object-cover" />
          <button
            type="button"
            onClick={() => onRemove(index)}
            className="absolute -right-[6px] -top-[6px] grid h-[20px] w-[20px] place-items-center rounded-full"
            style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}
            aria-label={t("components.commentSection.removePhoto")}
          >
            <X size={12} />
          </button>
        </div>
      ))}
    </div>
  );
}

function CommentItem({
  comment,
  depth = 0,
  onReply,
  readOnly = false,
  likeOverrides,
  onLikeChange,
  onDeleted,
}: {
  comment: Comment;
  depth?: number;
  onReply: (parentId: string, text: string, photos?: CommentPhotosPayload) => void;
  readOnly?: boolean;
  likeOverrides: Record<string, number>;
  onLikeChange: (id: string, likes: number) => void;
  onDeleted?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const guest = useGuestAccessOptional();
  const me = useStore(selectors.currentUser);
  const author = userById(comment.authorId);
  const [liked, setLiked] = useState(false);
  const likes = likeOverrides[comment.id] ?? comment.likes ?? 0;
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const isOwn = comment.authorId === me.id;
  const replyPhotos = useCommentPhotoDraft();

  const submit = () => {
    if (!draft.trim() && replyPhotos.photos.length === 0) return;
    runGuarded(guest, "feed.post.comment", () => {
      void (async () => {
        try {
          const photos = await replyPhotos.upload();
          onReply(comment.id, draft.trim(), photos.mediaIds.length ? photos : undefined);
          setDraft("");
          replyPhotos.clear();
          setReplying(false);
        } catch (err) {
          toast.error(formatApiErrorMessage(err, t("components.commentSection.photoUploadFailed")));
        }
      })();
    });
  };

  const toggleLike = () => {
    runGuarded(guest, "feed.post.like", () => {
      const next = !liked;
      setLiked(next);
      const nextLikes = likes + (next ? 1 : -1);
      onLikeChange(comment.id, nextLikes);
      reactToComment(comment.id, next).catch(() => {
        setLiked(!next);
        onLikeChange(comment.id, likes);
      });
    });
  };

  return (
    <>
      <div className="flex gap-[10px]" style={{ marginLeft: depth > 0 ? 36 : 0 }}>
        <CommentAvatar author={author} name={author.name} actionKey={authorActionKey(guest)} />
        <div className="min-w-0 flex-1">
          <div
            className="rounded-[12px] px-[12px] py-[8px]"
            style={{ background: "var(--background-surface)" }}
          >
            <div className="flex items-start gap-[8px]">
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline gap-[8px]">
                  {author.id ? (
                    <GuestGuardLink
                      actionKey={authorActionKey(guest)}
                      to={profileHref(author)}
                      className="text-[13px] font-semibold hover:underline"
                      style={{ color: "var(--foreground)" }}
                    >
                      {author.name}
                    </GuestGuardLink>
                  ) : (
                    <span className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                      {author.name}
                    </span>
                  )}
                  <span className="text-[11px]" style={{ color: "var(--foreground-50)" }}>
                    {formatDate(comment.time, "relative")}
                  </span>
                </div>
                {comment.text ? (
                  <p className="mt-[4px] whitespace-pre-line text-[14px]" style={{ color: "var(--foreground-90)" }}>
                    {comment.text}
                  </p>
                ) : null}
                <CommentPhotos urls={comment.images ?? []} />
              </div>
              {(isOwn || !readOnly) && (
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
                    {isOwn ? (
                      <DropdownMenuItem
                        onClick={() => {
                          if (!window.confirm(t("components.commentSection.deleteConfirm"))) return;
                          void deleteComment(comment.id)
                            .then(() => onDeleted?.(comment.id))
                            .catch((err) => {
                              toast.error(formatApiErrorMessage(err, t("components.commentSection.deleteFailed")));
                            });
                        }}
                      >
                        {t("components.commentSection.delete")}
                      </DropdownMenuItem>
                    ) : (
                      <DropdownMenuItem onClick={() => runGuarded(guest, "feed.post.comment", () => setReportOpen(true))}>
                        {t("components.commentSection.report")}
                      </DropdownMenuItem>
                    )}
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
            {!readOnly && (
              <button
                type="button"
                onClick={() => runGuarded(guest, "feed.post.comment", () => {
                  if (replying) {
                    setReplying(false);
                    setDraft("");
                    replyPhotos.clear();
                    return;
                  }
                  setReplying(true);
                  setDraft((d) => (d.trim() ? d : `${author.name}, `));
                })}
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
                <div>
                  <PhotoDraftStrip photos={replyPhotos.photos} onRemove={replyPhotos.remove} />
                  <div className="mt-[8px] flex items-center gap-[8px]">
                    <input
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && submit()}
                      placeholder={t("components.commentSection.replyTo", { name: author.name })}
                      className="flex-1 rounded-[10px] border px-[12px] py-[8px] text-[13px] outline-none"
                      style={{
                        background: "var(--background)",
                        borderColor: "var(--border)",
                        color: "var(--foreground)",
                      }}
                      autoFocus
                    />
                    <CommentAttachMenu onPick={replyPhotos.pick} disabled={replyPhotos.uploading} />
                    <button
                      type="button"
                      onClick={submit}
                      disabled={replyPhotos.uploading || (!draft.trim() && replyPhotos.photos.length === 0)}
                      className="grid h-[34px] w-[34px] place-items-center rounded-[10px] disabled:opacity-40"
                      style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                    >
                      <Send className="h-[14px] w-[14px]" />
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {comment.replies && comment.replies.length > 0 && (
            <div className="mt-[10px] space-y-[10px]">
              {comment.replies.map((r) => (
                <CommentItem
                  key={r.id}
                  comment={r}
                  depth={depth + 1}
                  onReply={onReply}
                  onDeleted={onDeleted}
                  readOnly={readOnly}
                  likeOverrides={likeOverrides}
                  onLikeChange={onLikeChange}
                />
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
  onSortChange,
  onDeleted,
}: Props) {
  const { t } = useTranslation();
  const guest = useGuestAccessOptional();
  const me = useStore(selectors.currentUser);
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<CommentSort>("interesting");
  const [likeOverrides, setLikeOverrides] = useState<Record<string, number>>({});
  const photos = useCommentPhotoDraft();

  useEffect(() => {
    if (!showAll) setPage(1);
  }, [showAll]);

  const handleReply = (parentId: string, text: string, attached?: CommentPhotosPayload) =>
    onAdd(text, parentId, attached);

  const submit = () => {
    runGuarded(guest, "feed.post.comment", () => {
      if (!draft.trim() && photos.photos.length === 0) return;
      void (async () => {
        try {
          const attached = await photos.upload();
          onAdd(draft.trim(), undefined, attached.mediaIds.length ? attached : undefined);
          setDraft("");
          photos.clear();
        } catch (err) {
          toast.error(formatApiErrorMessage(err, t("components.commentSection.photoUploadFailed")));
        }
      })();
    });
  };

  const commentBlocked = guest ? !guest.isAllowed("feed.post.comment") : false;

  const promptComposerAuth = (e: { preventDefault: () => void }) => {
    if (!commentBlocked) return;
    e.preventDefault();
    guest?.guardAction("feed.post.comment", () => {});
  };

  const applySort = (next: CommentSort) => {
    setSort(next);
    setPage(1);
    onSortChange?.(next);
  };

  const onLikeChange = (id: string, likes: number) => {
    setLikeOverrides((prev) => ({ ...prev, [id]: likes }));
  };

  const sortedComments = useMemo(
    () => sortComments(comments, sort, likeOverrides),
    [comments, sort, likeOverrides],
  );

  const visibleComments = useMemo(() => {
    if (showAll) {
      if (sortedComments.length <= PAGE_SIZE) return sortedComments;
      return sortedComments.slice(0, page * PAGE_SIZE);
    }
    if (previewLimit <= 0 || sortedComments.length <= previewLimit) return sortedComments;
    return sortedComments.slice(0, previewLimit);
  }, [sortedComments, previewLimit, showAll, page]);

  const hiddenCount = Math.max(0, (totalCount ?? comments.length) - visibleComments.length);
  const canLoadMore = showAll && sortedComments.length > visibleComments.length;
  const showSort = (totalCount ?? comments.length) > 1;

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
        <div className="flex items-start gap-[10px]">
          <CommentAvatar author={me} name={me.name} actionKey={authorActionKey(guest)} />
          <div className="min-w-0 flex-1">
            <div
              className="rounded-[12px] border px-[10px] py-[6px]"
              style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
            >
              <div className="flex min-w-0 items-center gap-[6px]">
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
                <CommentAttachMenu
                  onPick={(files) => {
                    if (commentBlocked) {
                      guest?.guardAction("feed.post.comment", () => {});
                      return;
                    }
                    photos.pick(files);
                  }}
                  disabled={commentBlocked || photos.uploading}
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
                  disabled={photos.uploading || (!draft.trim() && photos.photos.length === 0)}
                  className="grid h-[30px] w-[30px] place-items-center rounded-[10px] transition-opacity disabled:opacity-40"
                  style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
                  aria-label={t("components.commentSection.send")}
                >
                  <Send className="h-[14px] w-[14px]" />
                </button>
              </div>
              <PhotoDraftStrip photos={photos.photos} onRemove={photos.remove} />
            </div>
          </div>
        </div>
      )}

      {loading && comments.length === 0 ? (
        <CommentSkeleton />
      ) : (
        <>
          {showSort && (
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
                  ["old", t("components.commentSection.sortOld")],
                  ["new", t("components.commentSection.sortNew")],
                ] as const).map(([key, label]) => (
                  <DropdownMenuItem
                    key={key}
                    onSelect={() => applySort(key)}
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
                <CommentItem
                  key={c.id}
                  comment={c}
                  onReply={handleReply}
                  onDeleted={onDeleted}
                  readOnly={readOnly}
                  likeOverrides={likeOverrides}
                  onLikeChange={onLikeChange}
                />
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
