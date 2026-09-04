import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Heart, MessageCircle, Bookmark, Eye, Share2 } from "lucide-react";
import type { Post } from "@/lib/mock";
import { Gated, type Level } from "@/lib/gate";
import { RepostMenu } from "@/components/feed/RepostMenu";

/** Shared class for footer action buttons — ghost-style, accent hover, 44×44
 *  tap target even when the button holds nothing but a 16px icon. */
const actionCls =
  "inline-flex min-h-[44px] min-w-[44px] items-center justify-center gap-[6px] rounded-[10px] px-[10px] py-[7px] text-[13px] font-medium transition-colors hover:bg-[var(--accent-soft)] disabled:pointer-events-none disabled:opacity-45";

interface Props {
  post: Post;
  liked: boolean;
  likes: number;
  saved: boolean;
  saves: number;
  reposted: boolean;
  reposts: number;
  commentsCount: number;
  commentsEnabled: boolean;
  /** Channels may switch reactions off; everything else keeps them. */
  reactionsEnabled: boolean;
  canInteract: boolean;
  /** Required gate rung for a feed action key (from the guest-access config). */
  levelFor: (actionKey: string) => Level;
  onLike: () => void;
  onSave: () => void;
  onComments: () => void;
  onRepost: () => void;
  onShare: () => void;
}

/**
 * Reaction · comments · repost · save · share · views. Every mutating
 * action goes through the gate; a `post.can` verdict of false hides the
 * control instead of opening a window.
 */
export function PostActions({
  post, liked, likes, saved, saves, reposted, reposts, commentsCount, commentsEnabled, reactionsEnabled,
  canInteract, levelFor, onLike, onSave, onComments, onRepost, onShare,
}: Props) {
  const { t } = useTranslation();
  return (
    <footer
      className="flex items-center gap-[2px] px-[8px] pb-[8px] pt-[4px]"
      style={{ color: "var(--foreground-70)" }}
    >
      {reactionsEnabled && (
        <Gated level={levelFor("feed.post.like")} action={onLike} entity={post} actionName="react">
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
      )}

      {commentsEnabled && (
        <button
          type="button"
          onClick={onComments}
          disabled={!canInteract && commentsCount === 0}
          className={actionCls}
          style={{ color: "var(--foreground-70)" }}
          aria-label={t("components.postCard.commentsAria")}
          aria-disabled={!canInteract && commentsCount === 0}
        >
          <MessageCircle className="h-[16px] w-[16px]" />
          <span className="tabular-nums">{commentsCount}</span>
        </button>
      )}

      <RepostMenu postId={post.id} reposted={reposted} count={reposts} onRepost={onRepost} disabled={!canInteract} />

      <Gated level={levelFor("feed.post.save")} action={onSave} entity={post}>
        <button
          type="button"
          disabled={!canInteract}
          className={actionCls}
          style={{ color: saved ? "var(--accent)" : "var(--foreground-70)" }}
          aria-label={t("components.postCard.saveAria")}
          aria-disabled={!canInteract}
        >
          <motion.span whileTap={{ scale: 1.3 }} transition={{ type: "spring", stiffness: 500, damping: 14 }}>
            <Bookmark className="h-[16px] w-[16px]" fill={saved ? "currentColor" : "none"} />
          </motion.span>
          {saves > 0 && <span className="tabular-nums">{saves}</span>}
        </button>
      </Gated>

      <button
        type="button"
        onClick={onShare}
        className={actionCls}
        style={{ color: "var(--foreground-70)" }}
        aria-label="Поделиться"
      >
        <Share2 className="h-[16px] w-[16px]" />
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
  );
}
