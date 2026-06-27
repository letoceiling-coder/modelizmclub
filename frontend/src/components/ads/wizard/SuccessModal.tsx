import { AnimatePresence, motion } from "framer-motion";
import { CheckCircle2 } from "lucide-react";

interface Props {
  open: boolean;
  onClose: () => void;
}

export function SuccessModal({ open, onClose }: Props) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-[60] grid place-items-center p-[16px]"
          style={{ background: "rgba(0,0,0,0.55)" }}
        >
          <motion.div
            initial={{ scale: 0.94, opacity: 0, y: 10 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.96, opacity: 0 }}
            transition={{ type: "spring", damping: 24, stiffness: 280 }}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-[420px] overflow-hidden p-[28px] text-center"
            style={{
              background: "var(--background-elevated)",
              borderRadius: "var(--r-modal)",
              boxShadow: "var(--shadow-float)",
              border: "1px solid var(--border)",
            }}
          >
            <motion.div
              initial={{ scale: 0 }} animate={{ scale: 1 }}
              transition={{ type: "spring", damping: 14, stiffness: 220, delay: 0.1 }}
              className="mx-auto grid h-[64px] w-[64px] place-items-center"
              style={{ background: "var(--success-soft)", color: "var(--success)", borderRadius: "var(--r-pill)" }}
            >
              <CheckCircle2 size={32} strokeWidth={2.5} />
            </motion.div>
            <h3 className="mt-[18px] font-display text-[22px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Объявление отправлено!
            </h3>
            <p className="mx-auto mt-[8px] max-w-[300px] text-[14px]" style={{ color: "var(--foreground-70)" }}>
              Оплата принята (тестовый режим). Объявление пройдёт модерацию и появится в ленте в течение часа.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-[20px] w-full py-[12px] text-[14px] font-semibold transition-opacity hover:opacity-90"
              style={{ background: "var(--accent)", color: "#fff", borderRadius: "var(--r-button)", boxShadow: "var(--shadow-button)" }}
            >
              К списку объявлений
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
