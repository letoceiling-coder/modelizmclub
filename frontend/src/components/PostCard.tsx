import { useTranslation, tStatic } from "@/lib/i18n";
import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, MessageCircle, Bookmark, Eye, Repeat2 } from "lucide-react";
import type { Post, Comment, PostAuthor } from "@/lib/types";
import { useAuth } from "@/components/auth/AuthProvider";
import { avatarUrl } from "@/lib/utils/time";
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

export function PostCard({ post, isSavedExternal, onToggleSave }: Props) {
  const { t } = useTranslation();
  const { slug, displayName } = useAuth();
  const author = post.author;
  const reposter = post.repostedBy ?? null;

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

  const isLong = post.text.length > 220;
  const shown = !isLong || expanded ? post.text : post.text.slice(0, 220) + "…";
  const commentsCount =
    commentList.reduce((acc, c) => acc + 1 + (c.replies?.length ?? 0), 0) || post.comments;

  const toggleLike = () => {
    setLiked((v) => !v);
    setLikes((n) => n + (liked ? -1 : 1));
  };
  const toggleSave = () => {
    if (onToggleSave) onToggleSave(post.id);
    else setSavedInner((v) => !v);
    setSaves((n) => n + (saved ? -1 : 1));
  };
  const toggleRepost = () => {
    setReposted((v) => !v);
    setReposts((n) => n + (reposted ? -1 : 1));
  };

  const currentAuthor = (): PostAuthor => ({
    slug: slug ?? "me",
    name: displayName ?? tStatic("common.you"),
    avatar: avatarUrl(displayName ?? "Me"),
  });

  const addComment = (text: string, parentId?: string) => {
    const newC: Comment = {
      id: `nc${Date.now()}`,
      author: currentAuthor(),
      time: tStatic("common.justNow"),
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
  };

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, ease: [0.22, 1, 0.36, 1] }}
      className="overflow-hidden border sm:rounded-[16px]"
      style={{
        background: "var(--background-elevated)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
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
          <span>{t("post.repostedBy", { name: reposter.name })}</span>
        </div>
      )}

      <header className="flex items-center gap-[12px] px-[16px] pt-[16px]">
        <img src={author.avatar ?? avatarUrl(author.name)} alt={author.name} className="h-[40px] w-[40px] rounded-full" />
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-[8px]">
            <span className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
              {author.name}
            </span>
            {post.status === "moderation" && (
              <StatusBadge variant="moderation">{t("post.onModeration")}</StatusBadge>
            )}
          </div>
          <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {post.date} · {post.category}
          </div>
        </div>
        <PostActionMenu postId={post.id} saved={saved} title={post.title} text={post.text} onToggleSave={toggleSave} />

      </header>

      <button
        type="button"
        onClick={() => isLong && setExpanded((v) => !v)}
        className="block w-full px-[16px] pb-[12px] pt-[12px] text-left"
      >
        <h3
          className="text-[17px] font-semibold leading-tight"
          style={{ fontFamily: "var(--font-display)", color: "var(--foreground)", letterSpacing: "-0.01em" }}
        >
          {post.title}
        </h3>
        {post.tags && post.tags.length > 0 && (
          <div className="mt-[8px] flex flex-wrap gap-[6px]">
            {post.tags.map((t) => (
              <span
                key={t}
                className="rounded-[6px] px-[8px] py-[3px] text-[11px]"
                style={{
                  background: "var(--accent-soft)",
                  color: "var(--accent)",
                  fontFamily: "var(--font-mono)",
                }}
              >
                #{t}
              </span>
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
          <span className="mt-[6px] inline-block text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
            {expanded ? t("post.collapse") : t("post.readMore")}
          </span>
        )}
      </button>

      {post.image && (
        <div className="relative">
          <img
            src={post.image}
            alt={post.title}
            loading="lazy"
            className="aspect-[4/3] w-full object-cover sm:aspect-[16/10]"
          />
        </div>
      )}

      <footer
        className="flex items-center gap-[4px] px-[8px] py-[8px]"
        style={{ color: "var(--foreground-70)" }}
      >
        <button
          onClick={toggleLike}
          className="flex items-center gap-[6px] rounded-[10px] px-[10px] py-[6px] text-[13px] transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: liked ? "var(--accent)" : "var(--foreground-70)" }}
          aria-label={t("post.like")}
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

        <button
          onClick={() => setCommentsOpen((v) => !v)}
          className="flex items-center gap-[6px] rounded-[10px] px-[10px] py-[6px] text-[13px] transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: commentsOpen ? "var(--accent)" : "var(--foreground-70)" }}
          aria-label={t("post.comments")}
        >
          <MessageCircle className="h-[16px] w-[16px]" />
          <span>{commentsCount}</span>
        </button>

        <RepostMenu postId={post.id} reposted={reposted} count={reposts} onRepost={toggleRepost} />

        <button
          onClick={toggleSave}
          className="flex items-center gap-[6px] rounded-[10px] px-[10px] py-[6px] text-[13px] transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: saved ? "var(--accent)" : "var(--foreground-70)" }}
          aria-label={t("post.save")}
        >
          <motion.span whileTap={{ scale: 1.3 }} transition={{ type: "spring", stiffness: 500, damping: 14 }}>
            <Bookmark className="h-[16px] w-[16px]" fill={saved ? "currentColor" : "none"} />
          </motion.span>
          {saves > 0 && <span>{saves}</span>}
        </button>

        <div
          className="ml-auto hidden items-center gap-[6px] pr-[8px] text-[12px] sm:flex"
          style={{ color: "var(--foreground-50)" }}
        >
          <Eye className="h-[14px] w-[14px]" />
          <span>{post.views?.toLocaleString("ru-RU") ?? 0}</span>
        </div>
      </footer>

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
    </motion.article>
  );
}
