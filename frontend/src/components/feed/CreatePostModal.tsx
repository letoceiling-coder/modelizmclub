import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { CreatePostForm, type CreatePostPayload } from "@/components/CreatePostForm";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreate: (p: CreatePostPayload) => void;
}

export function CreatePostModal({ open, onClose, onCreate }: Props) {
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
            className="flex max-h-[92vh] w-full flex-col overflow-hidden rounded-t-[20px] sm:max-w-[600px] sm:rounded-[16px]"
            style={{ background: "var(--background-elevated)", border: "1px solid var(--border)" }}
          >
            <header
              className="flex items-center justify-between border-b px-[18px] py-[14px]"
              style={{ borderColor: "var(--border)" }}
            >
              <h2
                className="text-[16px] font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
              >
                Новая публикация
              </h2>
              <button
                onClick={onClose}
                aria-label="Закрыть"
                className="grid h-[32px] w-[32px] place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
                style={{ color: "var(--foreground-70)" }}
              >
                <X className="h-[18px] w-[18px]" />
              </button>
            </header>
            <div className="overflow-y-auto">
              <CreatePostForm
                compact
                onCreate={(p) => {
                  onCreate(p);
                  onClose();
                }}
              />
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
