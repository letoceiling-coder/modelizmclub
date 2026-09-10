import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Send, ChevronDown, Paperclip, X } from "lucide-react";
import type { Comment, User } from "@/lib/mock";
import { userById } from "@/lib/user-registry";
import { useCurrentUser } from "@/lib/session";
import { cn } from "@/lib/utils";
import { reactToComment, deleteComment, type CommentSort } from "@/lib/api/feed";
import { uploadMediaDeduped } from "@/lib/api/media";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { EmojiPicker } from "@/components/messenger/EmojiPicker";
import { ComplaintDialog } from "@/components/friends/ComplaintDialog";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useGuestAccessOptional } from "@/components/access/GuestAccessProvider";
import { useInsertAtCaret } from "@/lib/insert-at-caret";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import { ImageLightbox } from "@/components/ui/image-lightbox";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TimeAgo } from "@/components/TimeAgo";
import { askConfirm } from "@/lib/ui/ask";

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
  /** Server verdict for the whole thread: `can.comment === false` makes it read-only. */
  can?: Record<string, boolean>;
  /**
   * `inline` — ветка внутри карточки и внутри шторки: композер сверху, всё
   * растёт вниз вместе со страницей.
   * `panel` — колонка просмотрщика: занимает всю высоту, список прокручивается
   * отдельно, композер закреплён внизу.
   */
  layout?: "inline" | "panel";
  /**
   * Догрузить следующую страницу ветки. Задан — список подтягивает её сам,
   * когда прокрутка подходит к концу, и кнопка «Показать ещё» не нужна.
   */
  onLoadMore?: () => void;
  /** Идёт запрос следующей страницы: место под неё уже занято скелетом. */
  loadingMore?: boolean;
  /** Есть ли ещё непрочитанные страницы. */
  hasMore?: boolean;
}

/** Expanded lists grow in chunks so a thread with hundreds of replies
 *  doesn't mount at once and shift the feed. */
const PAGE_SIZE = 20;

/** Сдвиг ответа: 40 px — ширина аватара 32 плюс половина отступа. Глубже
 *  двух уровней ветка не уходит, поэтому сдвиг ровно один. */
const REPLY_INDENT = 40;

/** Сколько ответов видно до того, как ветку раскроют. */
const REPLY_PREVIEW = 3;

/**
 * Мелкое действие в строке под комментарием.
 *
 * Видимая высота 32, а не 44: строка набрана caption и несёт до четырёх
 * действий — четыре цели по 44 растянули бы её втрое и оторвали от текста,
 * к которому она относится. Зону нажатия добирает `hit-target`: его
 * псевдоэлемент растягивает только область попадания пальца, вёрстка и
 * размеры остаются прежними.
 */
const META_ACTION =
  "hit-target inline-flex min-h-[32px] cursor-pointer items-center transition-colors hover:text-[var(--foreground-90)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--accent)]";

function commentTime(c: Comment): number {
  const t = Date.parse(c.time);
  return Number.isFinite(t) ? t : 0;
}

function likesOf(c: Comment, overrides: Record<string, number>): number {
  return overrides[c.id] ?? c.likes ?? 0;
}

function sortComments(
  list: Comment[],
  mode: CommentSort,
  overrides: Record<string, number> = {},
): Comment[] {
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
          <div
            className="h-[32px] w-[32px] shrink-0 animate-pulse rounded-full"
            style={{ background: "var(--background-surface)" }}
          />
          <div className="min-w-0 flex-1">
            <div
              className="h-[52px] w-full animate-pulse rounded-[12px]"
              style={{ background: "var(--background-surface)" }}
            />
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
  // Общий аватар приложения. Здесь лежал свой — <img> с вариантом thumb и
  // собственные инициалы на акцентном фоне; ровно то, что UserAvatar уже
  // делает, только с другим цветом подложки и без запасного пути, когда
  // картинка не загрузилась.
  const face = <UserAvatar src={author.avatar} name={name} size={32} />;

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
            <img
              src={src}
              width={220}
              height={160}
              loading="lazy"
              decoding="async"
              alt=""
              className="max-h-[160px] max-w-[min(100%,220px)] object-cover"
            />
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
            className="relative grid h-[30px] w-[30px] shrink-0 place-items-center rounded-[10px] transition-opacity hover:opacity-80 disabled:opacity-40 before:absolute before:left-1/2 before:top-1/2 before:h-[44px] before:w-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
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
          <img
            src={item.url}
            width={64}
            height={64}
            loading="lazy"
            decoding="async"
            alt=""
            className="h-[64px] w-[64px] rounded-[10px] object-cover"
          />
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

/**
 * One comment. The thread is deliberately two levels deep and no more: at
 * 375px a third indent leaves no readable text column, and the API already
 * flattens every descendant under its root. So a reply to a reply is posted
 * against the *root* (`rootId`) and rendered on the same second level, with
 * a leading «@имя» naming who it answers.
 */
function CommentItem({
  comment,
  depth = 0,
  rootId,
  onReply,
  readOnly = false,
  likeOverrides,
  onLikeChange,
  onDeleted,
}: {
  comment: Comment;
  depth?: number;
  /** Set on second-level comments: the id of the root this thread hangs from. */
  rootId?: string;
  onReply: (parentId: string, text: string, photos?: CommentPhotosPayload) => void;
  readOnly?: boolean;
  likeOverrides: Record<string, number>;
  onLikeChange: (id: string, likes: number) => void;
  onDeleted?: (id: string) => void;
}) {
  const { t } = useTranslation();
  const guest = useGuestAccessOptional();
  const me = useCurrentUser();
  const author = userById(comment.authorId);
  const [liked, setLiked] = useState(false);
  const likes = likeOverrides[comment.id] ?? comment.likes ?? 0;
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [repliesOpen, setRepliesOpen] = useState(false);
  const allReplies = comment.replies ?? [];
  const visibleReplies = repliesOpen ? allReplies : allReplies.slice(0, REPLY_PREVIEW);
  const hiddenReplies = allReplies.length - visibleReplies.length;
  const isOwn = comment.authorId === me.id;
  // Server verdict wins when present (moderators); the author always may.
  const canDelete = isOwn || comment.can?.delete === true;
  const replyPhotos = useCommentPhotoDraft();
  // Replies always attach to the root, never to another reply — that is what
  // keeps the thread two levels deep on a 375px screen.
  const replyParentId = rootId ?? comment.id;

  const submit = () => {
    if (!draft.trim() && replyPhotos.photos.length === 0) return;
    runGuarded(guest, "feed.post.comment", () => {
      void (async () => {
        try {
          const photos = await replyPhotos.upload();
          onReply(replyParentId, draft.trim(), photos.mediaIds.length ? photos : undefined);
          setDraft("");
          replyPhotos.clear();
          setReplying(false);
        } catch (err) {
          toast.error(formatApiErrorMessage(err, t("components.commentSection.photoUploadFailed")));
        }
      })();
    });
  };

  const startReply = () =>
    runGuarded(guest, "feed.post.comment", () => {
      if (replying) {
        setReplying(false);
        setDraft("");
        replyPhotos.clear();
        return;
      }
      setReplying(true);
      // On the second level the indent no longer says who is being
      // answered, so the mention carries it instead.
      setDraft((d) => (d.trim() ? d : rootId ? `@${author.name}, ` : `${author.name}, `));
    });

  const removeComment = async () => {
    if (
      !(await askConfirm({ title: t("components.commentSection.deleteConfirm"), danger: true }))
    ) {
      return;
    }
    void deleteComment(comment.id)
      .then(() => onDeleted?.(comment.id))
      .catch((err) => {
        toast.error(formatApiErrorMessage(err, t("components.commentSection.deleteFailed")));
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
      <div className="flex gap-3" style={{ marginLeft: depth > 0 ? REPLY_INDENT : 0 }}>
        <CommentAvatar author={author} name={author.name} actionKey={authorActionKey(guest)} />
        <div className="min-w-0 flex-1">
          {/*
            Плоский комментарий, без пузыря.
            Серая подложка под каждой репликой делила и без того узкую панель
            просмотрщика на прямоугольники и отнимала по 12 px с каждой
            стороны — на 380 px это заметная доля строки. Имя автора стоит в
            одной строке с текстом, как во ВКонтакте: отдельная строка с
            именем и датой над текстом стоила ещё восемнадцать пикселей на
            каждый комментарий.
          */}
          <p
            className="whitespace-pre-line text-[14px] leading-[19px]"
            style={{ color: "var(--foreground-90)" }}
          >
            {author.id ? (
              <GuestGuardLink
                actionKey={authorActionKey(guest)}
                to={profileHref(author)}
                className="mr-1 font-semibold hover:underline"
                style={{ color: "var(--foreground)" }}
              >
                {author.name}
              </GuestGuardLink>
            ) : (
              <span className="mr-1 font-semibold" style={{ color: "var(--foreground)" }}>
                {author.name}
              </span>
            )}
            {comment.text}
          </p>
          <CommentPhotos urls={comment.images ?? []} />

          {/*
            Строка мета: время · Ответить · Пожаловаться (или Удалить) ·
            справа лайк со счётчиком.
            «Пожаловаться» и «Удалить» стоят здесь, а не под ⋯: меню на
            комментарии — это два нажатия ради одного действия и ещё один
            плавающий слой поверх панели, которая сама лежит поверх
            просмотрщика.
          */}
          <div
            className="mt-1 flex items-center gap-3 text-[12px]"
            style={{ color: "var(--foreground-50)" }}
          >
            <TimeAgo iso={comment.time} />
            {!readOnly && (
              <button type="button" onClick={startReply} className={META_ACTION}>
                {t("components.commentSection.reply")}
              </button>
            )}
            {!isOwn && !readOnly && (
              <button
                type="button"
                onClick={() => runGuarded(guest, "feed.post.comment", () => setReportOpen(true))}
                className={META_ACTION}
              >
                {t("components.commentSection.report")}
              </button>
            )}
            {canDelete && (
              <button type="button" onClick={removeComment} className={META_ACTION}>
                {t("common.delete")}
              </button>
            )}
            <button
              type="button"
              onClick={toggleLike}
              aria-label={t("components.postCard.likeAria")}
              className={cn(META_ACTION, "ml-auto flex items-center gap-1")}
              style={{ color: liked ? "var(--accent)" : "var(--foreground-50)" }}
            >
              <motion.span
                whileTap={{ scale: 1.4 }}
                transition={{ type: "spring", stiffness: 500, damping: 12 }}
              >
                <Heart className="h-[14px] w-[14px]" fill={liked ? "currentColor" : "none"} />
              </motion.span>
              {likes > 0 && <span className="tabular-nums">{likes}</span>}
            </button>
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
                      disabled={
                        replyPhotos.uploading || (!draft.trim() && replyPhotos.photos.length === 0)
                      }
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
              {visibleReplies.map((r) => (
                <CommentItem
                  key={r.id}
                  comment={r}
                  depth={1}
                  rootId={rootId ?? comment.id}
                  onReply={onReply}
                  onDeleted={onDeleted}
                  readOnly={readOnly}
                  likeOverrides={likeOverrides}
                  onLikeChange={onLikeChange}
                />
              ))}
              {/*
                Ответы приходят вложенными в свой корневой комментарий
                целиком — API их не разбивает на страницы. Значит,
                «Показать ещё» здесь ничего не грузит, а только показывает
                уже полученное: ветка из сорока ответов не должна занимать
                панель до самого низа, пока её об этом не попросили.
              */}
              {hiddenReplies > 0 && (
                <button
                  type="button"
                  onClick={() => setRepliesOpen(true)}
                  className={cn(META_ACTION, "text-[13px] font-semibold")}
                  style={{ color: "var(--accent)" }}
                >
                  {t("components.commentSection.showReplies", { count: hiddenReplies })}
                </button>
              )}
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
  readOnly: readOnlyProp = false,
  previewLimit = 3,
  showAll = false,
  onShowAll,
  onHide,
  totalCount,
  onSortChange,
  onDeleted,
  can,
  layout = "inline",
  onLoadMore,
  loadingMore = false,
  hasMore = false,
}: Props) {
  const { t } = useTranslation();
  const guest = useGuestAccessOptional();
  const me = useCurrentUser();
  const [draft, setDraft] = useState("");
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState<CommentSort>("interesting");
  const draftRef = useRef<HTMLInputElement>(null);
  const insertEmoji = useInsertAtCaret(draftRef, draft, setDraft);
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

  // Сервер честно отвечает can.comment=false и авторизованному без права
  // писать, и гостю — но для гостя это «войдите», а не «нельзя». Раньше оба
  // случая сворачивались в режим чтения, и гость не видел ни поля, ни кнопки
  // ответа: точки входа в окно не существовало, хотя карта доступа обещает
  // popup. Теперь только первый случай прячет композер.
  const readOnly = readOnlyProp || (can?.comment === false && !commentBlocked);

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

  /*
   * Догрузка по прокрутке.
   *
   * Сторож стоит под последним комментарием; как только он показывается в
   * прокручиваемой области, просим следующую страницу. Порог 240 px —
   * запрос уходит до того, как человек упрётся в конец, и подстановка
   * успевает произойти незаметно.
   *
   * `onLoadMore` вызывается только когда есть что грузить и предыдущий
   * запрос уже завершился: наблюдатель срабатывает и на изменение размера
   * списка, то есть сразу после подстановки новой страницы.
   */
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef(onLoadMore);
  loadMoreRef.current = onLoadMore;

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasMore || loadingMore || !onLoadMore) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMoreRef.current?.();
      },
      { root: scrollerRef.current, rootMargin: "240px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasMore, loadingMore, onLoadMore, comments.length]);

  const onLikeChange = (id: string, likes: number) => {
    setLikeOverrides((prev) => ({ ...prev, [id]: likes }));
  };

  const sortedComments = useMemo(
    () => sortComments(comments, sort, likeOverrides),
    [comments, sort, likeOverrides],
  );

  const visibleComments = useMemo(() => {
    // Когда страницы приходят с сервера, своей нарезки быть не должно: она
    // резала уже полученное поверх серверной, и догруженная страница
    // молча не показывалась — запрос уходил, список не менялся.
    if (onLoadMore) return sortedComments;
    if (showAll) {
      if (sortedComments.length <= PAGE_SIZE) return sortedComments;
      return sortedComments.slice(0, page * PAGE_SIZE);
    }
    if (previewLimit <= 0 || sortedComments.length <= previewLimit) return sortedComments;
    return sortedComments.slice(0, previewLimit);
  }, [sortedComments, previewLimit, showAll, page, onLoadMore]);

  const hiddenCount = Math.max(0, (totalCount ?? comments.length) - visibleComments.length);
  const canLoadMore = showAll && sortedComments.length > visibleComments.length;
  const showSort = (totalCount ?? comments.length) > 1;

  const sortLabel =
    sort === "interesting"
      ? t("components.commentSection.sortInteresting")
      : sort === "old"
        ? t("components.commentSection.sortOld")
        : t("components.commentSection.sortNew");

  const isLoading = Boolean(loading) && comments.length === 0;

  const composer = readOnly ? null : (
    <div className="flex items-start gap-[10px]">
      <CommentAvatar author={me} name={me.name} actionKey={authorActionKey(guest)} />
      <div className="min-w-0 flex-1">
        <div
          className="rounded-[12px] border px-[10px] py-[6px]"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
        >
          <div className="flex min-w-0 items-center gap-[6px]">
            <input
              ref={draftRef}
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
                insertEmoji(emoji);
              }}
              align="end"
              compact
            />
            <button
              type="button"
              onClick={submit}
              disabled={photos.uploading || (!draft.trim() && photos.photos.length === 0)}
              className="relative grid h-[30px] w-[30px] place-items-center rounded-[10px] transition-opacity disabled:opacity-40 before:absolute before:left-1/2 before:top-1/2 before:h-[44px] before:w-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
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
  );

  const sortControl = showSort ? (
    <DropdownMenu modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="hit-target inline-flex items-center gap-[4px] text-[13px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--foreground-70)" }}
        >
          {sortLabel}
          <ChevronDown className="h-[14px] w-[14px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="start"
        className="z-[var(--z-modal)] min-w-[220px] overflow-hidden rounded-[12px] border p-0"
        style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
      >
        {(
          [
            ["interesting", t("components.commentSection.sortInteresting")],
            ["old", t("components.commentSection.sortOld")],
            ["new", t("components.commentSection.sortNew")],
          ] as const
        ).map(([key, label]) => (
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
  ) : null;

  const items = (
    <>
      {canLoadMore && !onLoadMore && (
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
      {/*
        Место под догружаемую страницу занимается заранее.
        Скелет ровно той высоты, что займут первые строки следующей
        страницы: если показывать спиннер в одну строку, список подрастает
        рывком в тот момент, когда строки приходят, и прокрутка уезжает
        из-под пальца.
      */}
      {loadingMore && (
        <div className="mt-3" aria-live="polite" aria-busy="true">
          <span className="sr-only">{t("components.commentSection.loadingMore")}</span>
          <CommentSkeleton />
        </div>
      )}
      {onLoadMore && hasMore && <div ref={sentinelRef} className="h-px w-full" aria-hidden />}
    </>
  );

  const tail = (
    <>
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
    </>
  );

  /*
   * Раскладка панели просмотрщика.
   *
   * Сортировка стоит над списком и никуда не уезжает, список прокручивается
   * сам, композер прибит к низу. Иначе поле «Написать комментарий…» уходит
   * вверх вместе с веткой: в разговоре из тридцати реплик до него надо
   * пролистать всё обратно — а именно к нему человек и открыл панель.
   */
  if (layout === "panel") {
    return (
      <div className="flex min-h-0 flex-1 flex-col" style={{ background: "var(--background)" }}>
        {sortControl && (
          <div className="shrink-0 border-b px-4 py-2" style={{ borderColor: "var(--border)" }}>
            {sortControl}
          </div>
        )}
        <div ref={scrollerRef} className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {isLoading ? <CommentSkeleton /> : items}
          {tail}
        </div>
        {composer && (
          <div
            className="shrink-0 border-t px-4 py-3"
            style={{ borderColor: "var(--border)", background: "var(--background)" }}
          >
            {composer}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className="border-t px-[16px] py-[12px]"
      style={{ borderColor: "var(--border)", background: "var(--background-overlay)" }}
    >
      {composer}
      {isLoading ? (
        <CommentSkeleton />
      ) : (
        <>
          {sortControl && <div className="mt-[10px]">{sortControl}</div>}
          {items}
        </>
      )}
      {tail}
    </div>
  );
}
