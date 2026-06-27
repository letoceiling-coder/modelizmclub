import { motion, useInView } from "framer-motion";
import { Loader2 } from "lucide-react";
import { useEffect, useRef } from "react";

interface Props {
  onLoad: () => void;
  hasMore: boolean;
  isLoading: boolean;
}

export function InfiniteLoader({ onLoad, hasMore, isLoading }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const inView = useInView(ref, { margin: "-100px 0px" });

  useEffect(() => {
    if (inView && hasMore && !isLoading) onLoad();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, hasMore, isLoading]);

  if (!hasMore) {
    return (
      <div
        ref={ref}
        className="flex justify-center py-[24px] text-[13px]"
        style={{ color: "var(--foreground-30)", fontFamily: "var(--font-mono)" }}
      >
        — конец ленты —
      </div>
    );
  }

  return (
    <div ref={ref} className="flex justify-center py-[24px]">
      {isLoading ? (
        <div className="flex items-center gap-[10px]" style={{ color: "var(--foreground-50)" }}>
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
            className="grid h-[20px] w-[20px] place-items-center"
            style={{ color: "var(--accent)" }}
          >
            <Loader2 size={20} />
          </motion.div>
          <span className="text-[14px]" style={{ fontWeight: 500 }}>Загрузка…</span>
        </div>
      ) : (
        <button
          type="button"
          onClick={onLoad}
          className="px-[24px] text-[14px] font-semibold transition-colors"
          style={{
            background: "var(--background-surface)",
            color: "var(--foreground-70)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-button)",
            height: 44,
          }}
        >
          Показать ещё
        </button>
      )}
    </div>
  );
}
