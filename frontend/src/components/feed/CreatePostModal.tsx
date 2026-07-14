import { useEffect, useState } from "react";
import { CreatePostForm } from "@/components/CreatePostForm";
import type { ComposerSelection } from "@/components/feed/CreatePostMenu";
import type { Post } from "@/lib/mock";

interface Props {
  open: boolean;
  selection?: ComposerSelection;
  onClose: () => void;
  onCreate: (p: Post) => void;
}

const EXIT_MS = 200;

export function CreatePostModal({ open, selection, onClose, onCreate }: Props) {
  // Plain CSS transition instead of framer-motion's AnimatePresence: that
  // component's exit-sequencing on this tree was taking 1.2-1.4s to actually
  // unmount (proven by A/B — removing it dropped close time to ~55ms), likely
  // an AnimatePresence exit-detection edge case with this tree shape. mounted
  // controls presence; visible drives the CSS transition class.
  const [mounted, setMounted] = useState(open);
  const [visible, setVisible] = useState(open);

  useEffect(() => {
    if (open) {
      setMounted(true);
      // A short setTimeout instead of requestAnimationFrame: rAF timing proved
      // unreliable for this one-shot "flip to visible next tick" trigger
      // (needed so the browser paints the closed state before transitioning),
      // while setTimeout fires deterministically.
      const t = window.setTimeout(() => setVisible(true), 10);
      return () => window.clearTimeout(t);
    }
    setVisible(false);
    const t = window.setTimeout(() => setMounted(false), EXIT_MS);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose]);

  if (!mounted) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center transition-opacity sm:items-center"
      style={{ background: "rgba(0,0,0,0.55)", transitionDuration: `${EXIT_MS}ms`, opacity: visible ? 1 : 0 }}
      onClick={onClose}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex h-[85dvh] max-h-[85dvh] w-full flex-col overflow-hidden rounded-t-[20px] transition-[transform,opacity] sm:h-auto sm:max-h-[92dvh] sm:max-w-[600px] sm:rounded-[16px]"
        style={{
          background: "var(--background-elevated)",
          border: "1px solid var(--border)",
          transitionDuration: `${EXIT_MS + 50}ms`,
          transitionTimingFunction: "cubic-bezier(0.22, 1, 0.36, 1)",
          transform: visible ? "translateY(0) scale(1)" : "translateY(40px) scale(0.98)",
          opacity: visible ? 1 : 0,
        }}
      >
        <CreatePostForm
          selection={open ? selection : undefined}
          onCreate={onCreate}
          onClose={onClose}
        />
      </div>
    </div>
  );
}
