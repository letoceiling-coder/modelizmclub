import { AnimatePresence, motion } from "framer-motion";
import { Phone, Video, X } from "lucide-react";
import { userById } from "@/lib/mock";

interface Props {
  open: boolean;
  peerId: string;
  onCancel: () => void;
  onConfirm: (media: "audio" | "video") => void;
}

export function ConfirmCallDialog({ open, peerId, onCancel, onConfirm }: Props) {
  const peer = userById(peerId);
  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="ov"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[var(--z-overlay)]"
            style={{ background: "rgba(0,0,0,0.45)" }}
            onClick={onCancel}
          />
          <motion.div
            key="sheet"
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 32 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-call-title"
            className="fixed bottom-0 left-1/2 z-[var(--z-call)] w-[min(340px,calc(100vw-32px))] -translate-x-1/2 overflow-hidden rounded-t-[16px] border px-[20px] pt-[18px] pb-[max(16px,env(safe-area-inset-bottom))] sm:bottom-auto sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[16px]"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              className="absolute right-2 top-2 grid h-8 w-8 place-items-center rounded-full hover:bg-[var(--background-surface)]"
              style={{ color: "var(--foreground-50)" }}
              aria-label="Закрыть"
            >
              <X size={16} />
            </button>

            <div className="flex flex-col items-center text-center">
              <img
                src={peer.avatar}
                width={64}
                height={64}
                loading="lazy"
                decoding="async"
                alt=""
                className="h-[64px] w-[64px] rounded-full object-cover"
                style={{ border: "2px solid var(--border)" }}
              />
              <h3
                id="confirm-call-title"
                className="mt-[12px] font-display text-[17px] font-bold leading-tight"
                style={{ color: "var(--foreground)" }}
              >
                Позвонить {peer.name}?
              </h3>
              <p
                className="mt-[6px] text-[12px] leading-snug"
                style={{ color: "var(--foreground-50)" }}
              >
                Защищённое соединение внутри платформы
              </p>

              <div className="mt-[16px] flex w-full gap-[8px]">
                <button
                  type="button"
                  onClick={() => onConfirm("audio")}
                  className="inline-flex h-[44px] flex-1 items-center justify-center gap-[6px] rounded-[10px] text-[14px] font-semibold text-white transition-transform active:scale-[0.98]"
                  style={{ background: "var(--accent)" }}
                >
                  <Phone size={16} />
                  Аудио
                </button>
                <button
                  type="button"
                  onClick={() => onConfirm("video")}
                  className="inline-flex h-[44px] flex-1 items-center justify-center gap-[6px] rounded-[10px] border text-[14px] font-semibold transition-transform active:scale-[0.98]"
                  style={{
                    background: "var(--background)",
                    color: "var(--foreground)",
                    borderColor: "var(--border)",
                  }}
                >
                  <Video size={16} />
                  Видео
                </button>
              </div>
              <button
                type="button"
                onClick={onCancel}
                className="mt-[10px] h-[36px] w-full rounded-[8px] text-[13px] font-medium transition-colors hover:bg-[var(--background-surface)]"
                style={{ color: "var(--foreground-50)" }}
              >
                Отмена
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
