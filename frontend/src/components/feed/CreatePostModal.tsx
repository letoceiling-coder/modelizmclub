import { useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { CreatePostForm, type CreatePostPayload, type CreatePostFormHandle } from "@/components/CreatePostForm";
import type { PostIntent } from "@/components/feed/CreatePostTrigger";

interface Props {
  open: boolean;
  intent?: PostIntent;
  onClose: () => void;
  onCreate: (p: CreatePostPayload) => void;
}

export function CreatePostModal({ open, intent, onClose, onCreate }: Props) {
  const formRef = useRef<CreatePostFormHandle>(null);
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

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 40, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 40, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="flex h-[88vh] w-full flex-col overflow-hidden rounded-t-[20px] sm:h-auto sm:max-h-[92vh] sm:max-w-[600px] sm:rounded-[16px]"
            style={{ background: "var(--background-elevated)", border: "1px solid var(--border)" }}
          >
            <header
              className="flex items-center justify-between gap-[12px] border-b px-[12px] py-[10px]"
              style={{ borderColor: "var(--border)" }}
            >
              <button
                onClick={onClose}
                aria-label="Закрыть"
                className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
                style={{ color: "var(--foreground-70)" }}
              >
                <X className="h-[20px] w-[20px]" />
              </button>
              <h2
                className="min-w-0 flex-1 truncate text-center text-[16px] font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
              >
                Новая публикация
              </h2>
              <button
                onClick={() => { if (formRef.current?.submit()) onClose(); }}
                className="shrink-0 rounded-[var(--r-pill)] px-[16px] py-[8px] text-[14px] font-semibold transition-opacity hover:opacity-90"
                style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                Опубл.
              </button>
            </header>
            <CreatePostForm
              ref={formRef}
              intent={open ? intent : undefined}
              onCreate={onCreate}
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
