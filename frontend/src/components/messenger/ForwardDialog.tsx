import { useEffect, useRef } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Message } from "@/lib/mock";
import { userById } from "@/lib/mock";
import { useStore, selectors, actions } from "@/lib/store";

interface Props {
  message: Message | null;
  onClose: () => void;
}

export function ForwardDialog({ message, onClose }: Props) {
  const dialogs = useStore(selectors.dialogsList);
  const meId = useStore((s) => s.currentUserId);
  const ref = useRef<HTMLDivElement>(null);
  const open = Boolean(message);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const forwardTo = (targetDialogId: string) => {
    if (!message) return;
    const forwarded: Message = {
      ...message,
      id: `tmp${Date.now()}`,
      authorId: meId,
      time: new Date().toISOString(),
      status: "sent",
      replyTo: undefined,
      pinned: false,
      deletedForMe: false,
      forwardedFrom: message.authorId,
    };
    actions.addMessage(targetDialogId, forwarded);
    toast.success("Сообщение переслано");
    onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[80]"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={onClose}
          />
          <motion.div
            key="dialog"
            ref={ref}
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-[81] w-[min(400px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[16px] border"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            <div className="flex items-center gap-[8px] border-b px-[16px] py-[12px]" style={{ borderColor: "var(--border)" }}>
              <h3 className="flex-1 font-display text-[16px] font-bold" style={{ color: "var(--foreground)" }}>
                Переслать сообщение
              </h3>
              <button
                onClick={onClose}
                className="grid h-[32px] w-[32px] place-items-center rounded-full"
                style={{ color: "var(--foreground-50)" }}
                aria-label="Закрыть"
              >
                <X size={16} />
              </button>
            </div>
            <ul className="max-h-[360px] overflow-y-auto py-[8px]">
              {dialogs.length === 0 ? (
                <li className="px-[20px] py-[24px] text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>
                  Нет диалогов
                </li>
              ) : (
                dialogs.map((d) => {
                  const u = userById(d.userId);
                  return (
                    <li key={d.id}>
                      <button
                        onClick={() => forwardTo(d.id)}
                        className="flex w-full items-center gap-[12px] px-[16px] py-[10px] text-left transition-colors hover:bg-[var(--background-surface)]"
                      >
                        <img src={u.avatar} alt="" className="h-[36px] w-[36px] rounded-full object-cover" />
                        <span className="truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                          {u.name}
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
