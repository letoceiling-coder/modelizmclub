import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Bookmark, Eye, Repeat2, ImageOff } from "lucide-react";
import type { Post, Comment } from "@/lib/mock";
import { userById, formatRelativeTime } from "@/lib/mock";
import { useStore, selectors } from "@/lib/store";
import {
  reactToPost,
  bookmarkPost,
  fetchPostComments,
  createComment,
} from "@/lib/api/feed";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/StatusBadge";
import { CommentSection } from "@/components/feed/CommentSection";
import { RepostMenu } from "@/components/feed/RepostMenu";
import { PostActionMenu } from "@/components/post/PostActionMenu";

interface Props {
  post: Post;
  onTogglePost?: (id: string, patch: Partial<Post>) => void;
  isSavedExternal?: boolean;
  onToggleSave?: (id: string) => void;
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

/** Media block: fixed 16:9 aspect ratio, object-fit cover. A broken/missing
 *  image degrades to a COMPACT placeholder bar (not a half-screen empty block). */
function PostMedia({ src, alt }: { src: string; alt: string }) {
  const [err, setErr] = useState(false);
  if (err) {
    return (
      <div
        className="flex h-[96px] w-full items-center justify-center gap-[8px]"
        style={{ background: "var(--background-surface)", color: "var(--foreground-30)" }}
        aria-label="Изображение недоступно"
      >
        <ImageOff className="h-[20px] w-[20px]" />
        <span className="text-[12px]" style={{ color: "var(--foreground-30)" }}>Фото недоступно</span>
      </div>
    );
  }
  return (
    <div className="aspect-video overflow-hidden">
      <img
        src={src}
        alt={alt}
        loading="lazy"
        decoding="async"
        className="h-full w-full object-cover"
        onError={() => setErr(true)}
      />
    </div>
  );
}

/** Shared class for footer action buttons — ghost-style, accent hover */
const actionCls =
  "inline-flex items-center gap-[6px] rounded-[10px] px-[10px] py-[7px] text-[13px] font-medium transition-colors hover:bg-[var(--accent-soft)]";

export function PostCard({ post, isSavedExternal, onToggleSave }: Props) {
  const me = useStore(selectors.currentUser);
  const author = userById(post.authorId);
  const reposter = post.repostedBy ? userById(post.repostedBy) : null;

  const [liked, setLiked] = useState(!!post.isLiked);
  const [savedInner, setSavedInner] = useState(!!post.isSaved);
  const saved = isSavedExternal ?? savedInner;
  const [reposted, setReposted] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [commentsOpen, setCommentsOpen] = useState(false);

  const [likes, setLikes] = useState(post.likes);
  const [saves, setSaves] = useState(post.saves ?? 0);
  const [reposts, setReposts] = useState(post.reposts ?? 0);
  const [commentList, setCommentList] = useState<Comment[]>(post.commentList ?? []);
  const [commentsLoaded, setCommentsLoaded] = useState(false);

  useEffect(() => {
    if (!commentsOpen || commentsLoaded) return;
    setCommentsLoaded(true);
    fetchPostComments(post.id)
      .then(setCommentList)
      .catch(() => {});
  }, [commentsOpen, commentsLoaded, post.id]);

  const isLong = post.text.length > 220;
  const shown = !isLong || expanded ? post.text : post.text.slice(0, 220) + "…";
  const commentsCount =
    commentList.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0) || post.comments;

  const toggleLike = () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    reactToPost(post.id, next).catch(() => {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
    });
  };
  const toggleSave = () => {
    const next = !saved;
    if (onToggleSave) onToggleSave(post.id);
    else setSavedInner((v) => !v);
    setSaves((n) => n + (next ? 1 : -1));
    bookmarkPost(post.id, next).catch(() => {
      if (!onToggleSave) setSavedInner((v) => !v);
      setSaves((n) => n + (next ? -1 : 1));
    });
  };
  const toggleRepost = () => {
    setReposted((v) => !v);
    setReposts((n) => n + (reposted ? -1 : 1));
  };

  const addComment = (text: string, parentId?: string) => {
    const tempId = `nc${Date.now()}`;
    const newC: Comment = {
      id: tempId,
      authorId: me.id,
      time: "только что",
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
              сделал репост
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
                <StatusBadge variant="moderation">На модерации</StatusBadge>
              )}
            </div>
            <div className="mt-[1px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {formatRelativeTime(post.date)}
              {post.category && (
                <>
                  {" · "}
                  <span>{post.category}</span>
                </>
              )}
            </div>
          </div>
          <PostActionMenu postId={post.id} saved={saved} title={post.title} text={post.text} />
        </header>

        {/* Content */}
        <div className="px-[16px] pb-[12px] pt-[12px]">
          <h3
            className="text-[17px] font-semibold leading-tight"
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
              {expanded ? "Свернуть" : "Читать полностью"}
            </button>
          )}
        </div>

        {/* Media */}
        {post.image && <PostMedia src={post.image} alt={post.title} />}

        {/* Footer actions */}
        <footer
          className="flex items-center gap-[2px] px-[8px] pb-[8px] pt-[4px]"
          style={{ color: "var(--foreground-70)" }}
        >
          {/* Like */}
          <button
            onClick={toggleLike}
            className={actionCls}
            style={{ color: liked ? "var(--accent)" : "var(--foreground-70)" }}
            aria-label="Нравится"
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
                initial={{ y: 6, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: -6, opacity: 0 }}
                transition={{ duration: 0.18 }}
              >
                {likes}
              </motion.span>
            </AnimatePresence>
          </button>

          {/* Comments */}
          <button
            onClick={() => setCommentsOpen((v) => !v)}
            className={actionCls}
            style={{ color: commentsOpen ? "var(--accent)" : "var(--foreground-70)" }}
            aria-label="Комментарии"
          >
            <MessageCircle className="h-[16px] w-[16px]" />
            <span>{commentsCount}</span>
          </button>

          {/* Repost */}
          <RepostMenu postId={post.id} reposted={reposted} count={reposts} onRepost={toggleRepost} />

          {/* Save */}
          <button
            onClick={toggleSave}
            className={actionCls}
            style={{ color: saved ? "var(--accent)" : "var(--foreground-70)" }}
            aria-label="Сохранить"
          >
            <motion.span
              whileTap={{ scale: 1.3 }}
              transition={{ type: "spring", stiffness: 500, damping: 14 }}
            >
              <Bookmark className="h-[16px] w-[16px]" fill={saved ? "currentColor" : "none"} />
            </motion.span>
            {saves > 0 && <span>{saves}</span>}
          </button>

          {/* Views — desktop only */}
          <div
            className="ml-auto hidden items-center gap-[6px] pr-[8px] text-[12px] sm:flex"
            style={{ color: "var(--foreground-50)" }}
          >
            <Eye className="h-[14px] w-[14px]" />
            <span>{post.views?.toLocaleString("ru-RU") ?? 0}</span>
          </div>
        </footer>

        {/* Comments section */}
        <AnimatePresence initial={false}>
          {commentsOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
              className="overflow-hidden"
            >
              <CommentSection comments={commentList} onAdd={addComment} />
            </motion.div>
          )}
        </AnimatePresence>
      </Card>
    </motion.div>
  );
}
