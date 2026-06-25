import { motion } from "framer-motion";
import { Check } from "lucide-react";

interface Props {
  current: number; // 1..3
  labels: string[];
}

export function StepIndicator({ current, labels }: Props) {
  return (
    <div className="flex items-center gap-[8px]">
      {labels.map((label, i) => {
        const n = i + 1;
        const done = n < current;
        const active = n === current;
        return (
          <div key={label} className="flex flex-1 items-center gap-[8px]">
            <div className="flex flex-col items-center gap-[6px]">
              <motion.div
                animate={{ scale: active ? 1.05 : 1 }}
                className="grid h-[36px] w-[36px] place-items-center text-[13px] font-semibold"
                style={{
                  background: done || active ? "var(--accent)" : "var(--background-surface)",
                  color: done || active ? "#fff" : "var(--foreground-50)",
                  border: `2px solid ${active ? "var(--accent)" : "transparent"}`,
                  borderRadius: "var(--r-pill)",
                  boxShadow: active ? "var(--shadow-glow-accent)" : "none",
                }}
              >
                {done ? <Check size={16} strokeWidth={3} /> : n}
              </motion.div>
              <div
                className="hidden whitespace-nowrap text-[11px] font-medium sm:block"
                style={{ color: done || active ? "var(--foreground)" : "var(--foreground-50)" }}
              >
                {label}
              </div>
            </div>
            {i < labels.length - 1 && (
              <div className="relative h-[2px] flex-1 overflow-hidden" style={{ background: "var(--background-surface)" }}>
                <motion.div
                  initial={false}
                  animate={{ scaleX: done ? 1 : 0 }}
                  transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                  className="absolute inset-0 origin-left"
                  style={{ background: "var(--accent)" }}
                />
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
