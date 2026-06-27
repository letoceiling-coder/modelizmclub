import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Heart, Reply, Send } from "lucide-react";
import type { Comment } from "@/lib/mock";
import { userById, me } from "@/lib/mock";

interface Props {
  comments: Comment[];
  onAdd: (text: string, parentId?: string) => void;
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
              {comment.time}
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
              <Reply className="h-[12px] w-[12px]" /> Ответить
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
                  placeholder={`Ответить ${author.name}…`}
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
                  style={{ background: "var(--accent)", color: "#fff" }}
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

export function CommentSection({ comments, onAdd }: Props) {
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
          placeholder="Написать комментарий…"
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
          style={{ background: "var(--accent)", color: "#fff", boxShadow: "var(--shadow-button)" }}
          aria-label="Отправить"
        >
          <Send className="h-[14px] w-[14px]" />
        </button>
      </div>

      {comments.length > 0 && (
        <div className="mt-[16px] space-y-[16px]">
          {comments.map((c) => (
            <CommentItem key={c.id} comment={c} onReply={handleReply} />
          ))}
        </div>
      )}
    </div>
  );
}
