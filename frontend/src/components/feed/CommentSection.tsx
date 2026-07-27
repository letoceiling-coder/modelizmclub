import { useState } from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Reply, Send } from "lucide-react";
import type { Comment } from "@/lib/mock";
import { userById, formatRelativeTime } from "@/lib/mock";
import { useStore, selectors } from "@/lib/store";

interface Props {
  comments: Comment[];
  onAdd: (text: string, parentId?: string) => void;
  /** Show a placeholder while the first comments fetch is in flight — keeps the
   *  panel height stable so opening doesn't jump twice. */
  loading?: boolean;
}

function CommentSkeleton() {
  return (
    <div className="mt-[16px] space-y-[16px]" aria-hidden>
      {[0, 1].map((i) => (
        <div key={i} className="flex gap-[12px]">
          <div className="h-[32px] w-[32px] shrink-0 animate-pulse rounded-full" style={{ background: "var(--background-surface)" }} />
          <div className="min-w-0 flex-1">
            <div className="h-[52px] w-full animate-pulse rounded-[12px]" style={{ background: "var(--background-surface)" }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function CommentItem({
  comment,
  depth = 0,
  onReply,
}: {
  comment: Comment;
  depth?: number;
  onReply: (parentId: string, text: string) => void;
}) {
  const { t } = useTranslation();
  const author = userById(comment.authorId);
  const [liked, setLiked] = useState(false);
  const [likes, setLikes] = useState(comment.likes ?? 0);
  const [replying, setReplying] = useState(false);
  const [draft, setDraft] = useState("");

  const submit = () => {
    if (!draft.trim()) return;
    onReply(comment.id, draft.trim());
    setDraft("");
    setReplying(false);
  };

  return (
    <div
      className="flex gap-[12px]"
      style={{ marginLeft: depth > 0 ? 40 : 0 }}
    >
      <img src={author.avatar} alt={author.name} className="h-[32px] w-[32px] shrink-0 rounded-full" />
      <div className="min-w-0 flex-1">
        <div
          className="rounded-[12px] px-[12px] py-[8px]"
          style={{ background: "var(--background-surface)" }}
        >
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
        <div className="mt-[6px] flex items-center gap-[12px] pl-[12px] text-[12px]" style={{ color: "var(--foreground-70)" }}>
          <button
            onClick={() => {
              setLiked(!liked);
              setLikes(likes + (liked ? -1 : 1));
            }}
            className="flex items-center gap-[4px] transition-colors"
            style={{ color: liked ? "var(--accent)" : "var(--foreground-70)" }}
          >
            <motion.span whileTap={{ scale: 1.4 }} transition={{ type: "spring", stiffness: 500, damping: 12 }}>
              <Heart className="h-[12px] w-[12px]" fill={liked ? "currentColor" : "none"} />
            </motion.span>
            {likes > 0 && <span>{likes}</span>}
          </button>
          {depth < 1 && (
            <button onClick={() => setReplying((v) => !v)} className="flex items-center gap-[4px] hover:opacity-80">
              <Reply className="h-[12px] w-[12px]" /> {t("components.commentSection.reply")}
            </button>
          )}
        </div>

        <AnimatePresence>
          {replying && (
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
          <div className="mt-[12px] space-y-[12px]">
            {comment.replies.map((r) => (
              <CommentItem key={r.id} comment={r} depth={depth + 1} onReply={onReply} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export function CommentSection({ comments, onAdd, loading }: Props) {
  const { t } = useTranslation();
  const me = useStore(selectors.currentUser);
  const [draft, setDraft] = useState("");

  const handleReply = (parentId: string, text: string) => onAdd(text, parentId);

  const submit = () => {
    if (!draft.trim()) return;
    onAdd(draft.trim());
    setDraft("");
  };

  return (
    <div
      className="border-t px-[16px] py-[16px]"
      style={{ borderColor: "var(--border)", background: "var(--background-overlay)" }}
    >
      <div className="flex items-center gap-[12px]">
        <img src={me.avatar} alt={me.name} className="h-[32px] w-[32px] rounded-full" />
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && submit()}
          onFocus={(e) => {
            // Keyboard covers the input when comments open near the page
            // bottom. Wait for the on-screen keyboard to animate in, then
            // centre the field in the (now shorter) viewport.
            const el = e.currentTarget;
            setTimeout(() => el.scrollIntoView({ block: "center", behavior: "smooth" }), 300);
          }}
          placeholder={t("components.commentSection.placeholder")}
          className="flex-1 rounded-[10px] border px-[12px] py-[8px] text-[14px] outline-none"
          style={{
            background: "var(--background-elevated)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
        />
        <button
          onClick={submit}
          className="grid h-[36px] w-[36px] place-items-center rounded-[10px] transition-opacity hover:opacity-90"
          style={{ background: "var(--accent)", color: "var(--accent-foreground)", boxShadow: "var(--shadow-button)" }}
          aria-label={t("components.commentSection.send")}
        >
          <Send className="h-[14px] w-[14px]" />
        </button>
      </div>

      {loading && comments.length === 0 ? (
        <CommentSkeleton />
      ) : (
        comments.length > 0 && (
          <div className="mt-[16px] space-y-[16px]">
            {comments.map((c) => (
              <CommentItem key={c.id} comment={c} onReply={handleReply} />
            ))}
          </div>
        )
      )}
    </div>
  );
}
