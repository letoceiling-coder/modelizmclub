import { useTranslation } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { MoreHorizontal, Bookmark, BookmarkCheck, Link2, Share2, EyeOff, Flag, Check } from "lucide-react";
import { toast } from "sonner";
import { actions } from "@/lib/store";

interface Props {
  postId: string;
  saved: boolean;
  title: string;
  text: string;
}

export function PostActionMenu({ postId, saved, title, text }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const buildUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/?post=${postId}`;
  };

  const handleSave = () => {
    actions.savePost(postId, !saved);
    toast.success(saved ? t("post.unsaved") : t("post.saved"));
    setOpen(false);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildUrl());
      setCopied(true);
      toast.success(t("post.linkCopied"));
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error(t("common.copyLinkFailed"));
    }
  };

  const handleShare = async () => {
    setOpen(false);
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, text, url: buildUrl() });
        return;
      } catch {
        // user cancelled or unsupported — fall through to copy
      }
    }
    await handleCopy();
  };

  const placeholder = (label: string) => () => {
    setOpen(false);
    toast(t("common.comingSoon", { label }));
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-[32px] w-[32px] place-items-center rounded-[8px] hover:bg-[var(--background-surface)]"
        style={{ color: "var(--foreground-70)" }}
        aria-label={t("post.menuActions")}
        aria-expanded={open}
      >
        <MoreHorizontal className="h-[16px] w-[16px]" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={{ opacity: 0, y: -6, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
            className="absolute right-0 top-full z-[60] mt-[6px] w-[240px] overflow-hidden rounded-[12px] border"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            <MenuItem onClick={handleSave} icon={saved ? BookmarkCheck : Bookmark} label={saved ? t("post.menuUnsave") : t("post.save")} accent={saved} />
            <MenuItem onClick={handleCopy} icon={copied ? Check : Link2} label={copied ? t("post.menuCopied") : t("post.menuCopyLink")} accent={copied} />
            <MenuItem onClick={handleShare} icon={Share2} label={t("post.menuShare")} />
            <div className="border-t" style={{ borderColor: "var(--border)" }} />
            <MenuItem onClick={placeholder(t("post.hidePost"))} icon={EyeOff} label={t("post.menuHide")} />
            <MenuItem onClick={placeholder(t("post.reportPost"))} icon={Flag} label={t("post.menuReport")} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  icon: typeof Bookmark;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-[10px] px-[14px] py-[10px] text-left text-[13px] transition-colors hover:bg-[var(--background-surface)]"
      style={{ color: "var(--foreground)" }}
    >
      <Icon className="h-[16px] w-[16px]" style={{ color: accent ? "var(--accent)" : "var(--foreground-70)" }} />
      {label}
    </button>
  );
}
