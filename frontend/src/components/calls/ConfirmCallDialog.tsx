import { useTranslation } from "@/lib/i18n";
import { AnimatePresence, motion } from "framer-motion";
import { Phone, X } from "lucide-react";
import { userById } from "@/lib/mock";

interface Props {
  open: boolean;
  peerId: string;
  onCancel: () => void;
  onConfirm: () => void;
}

export function ConfirmCallDialog({ open, peerId, onCancel, onConfirm }: Props) {
  const { t } = useTranslation();
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
            className="fixed inset-0 z-[90]"
            style={{ background: "rgba(0,0,0,0.5)" }}
            onClick={onCancel}
          />
          {/* Mobile: bottom sheet. Desktop: centered dialog */}
          <motion.div
            key="sheet"
            initial={{ opacity: 0, y: 40 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 40 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 z-[91] w-[min(420px,100vw)] -translate-x-1/2 overflow-hidden border p-6 sm:top-1/2 sm:-translate-y-1/2 sm:rounded-[20px]"
            style={{
              bottom: 0,
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              borderRadius: "20px 20px 0 0",
              paddingBottom: "max(24px, env(safe-area-inset-bottom))",
              boxShadow: "0 -8px 40px rgba(0,0,0,0.3)",
            }}
          >
            <button
              type="button"
              onClick={onCancel}
              className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full hover:bg-[var(--background-surface)]"
              style={{ color: "var(--foreground-50)" }}
              aria-label={t("common.close")}
            >
              <X size={18} />
            </button>
            <div className="flex flex-col items-center text-center">
              <div className="relative">
                <span
                  className="absolute inset-0 rounded-full"
                  style={{ background: "color-mix(in oklab, var(--accent) 30%, transparent)", filter: "blur(20px)" }}
                />
                <img
                  src={peer.avatar}
                  alt=""
                  className="relative h-[88px] w-[88px] rounded-full object-cover"
                  style={{ border: "3px solid var(--background-elevated)" }}
                />
              </div>
              <h3 className="mt-4 font-display text-[20px] font-bold" style={{ color: "var(--foreground)" }}>
                {t("calls.confirmTitle", { name: peer.name })}
              </h3>
              <p className="mt-2 text-[14px]" style={{ color: "var(--foreground-70)" }}>{t("calls.confirmDesc")}</p>
              <div className="mt-6 flex w-full flex-col-reverse gap-2 sm:flex-row">
                <button
                  type="button"
                  onClick={onCancel}
                  className="h-12 flex-1 rounded-xl text-[15px] font-semibold transition-colors"
                  style={{ background: "var(--background-surface)", color: "var(--foreground)" }}
                >{t("common.cancel")}</button>
                <button
                  type="button"
                  onClick={onConfirm}
                  className="inline-flex h-12 flex-1 items-center justify-center gap-2 rounded-xl text-[15px] font-semibold text-white transition-transform active:scale-[0.98]"
                  style={{ background: "var(--accent)", boxShadow: "0 8px 20px -6px color-mix(in oklab, var(--accent) 50%, transparent)" }}
                >
                  <Phone size={18} />{t("calls.confirmCall")}</button>
              </div>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
