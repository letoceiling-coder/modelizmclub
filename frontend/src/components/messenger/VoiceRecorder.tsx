import { useTranslation } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Mic, Trash2 } from "lucide-react";

const MAX_SECONDS = 180;
const CANCEL_THRESHOLD = 80; // px

export function VoiceRecorder({ onSend }: { onSend: (durationSec: number) => void }) {
  const { t } = useTranslation();
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dx, setDx] = useState(0); // negative when swiping left
  const startX = useRef<number | null>(null);
  const startTime = useRef<number>(0);
  const timer = useRef<number | null>(null);
  const canceledRef = useRef(false);

  const stop = (cancel: boolean) => {
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }
    const dur = Math.max(1, Math.round((performance.now() - startTime.current) / 1000));
    setRecording(false);
    setDx(0);
    startX.current = null;
    setElapsed(0);
    if (!cancel && !canceledRef.current) onSend(Math.min(MAX_SECONDS, dur));
    canceledRef.current = false;
  };

  const begin = (clientX: number) => {
    canceledRef.current = false;
    startX.current = clientX;
    startTime.current = performance.now();
    setElapsed(0);
    setDx(0);
    setRecording(true);
    timer.current = window.setInterval(() => {
      const e = (performance.now() - startTime.current) / 1000;
      if (e >= MAX_SECONDS) {
        setElapsed(MAX_SECONDS);
        stop(false);
      } else {
        setElapsed(e);
      }
    }, 100);
  };

  const onPointerDown = (ev: React.PointerEvent<HTMLButtonElement>) => {
    ev.preventDefault();
    (ev.target as HTMLElement).setPointerCapture?.(ev.pointerId);
    begin(ev.clientX);
  };
  const onPointerMove = (ev: React.PointerEvent<HTMLButtonElement>) => {
    if (!recording || startX.current === null) return;
    const delta = Math.min(0, ev.clientX - startX.current);
    setDx(delta);
    if (delta <= -CANCEL_THRESHOLD) {
      canceledRef.current = true;
      stop(true);
    }
  };
  const onPointerUp = () => {
    if (!recording) return;
    stop(canceledRef.current);
  };

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
    },
    []
  );

  const cancelProgress = Math.min(1, Math.abs(dx) / CANCEL_THRESHOLD);

  return (
    <>
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-20 flex items-center gap-[12px] px-[16px]"
            style={{
              background: "var(--background)",
              borderTop: "1px solid var(--border)",
            }}
          >
            <motion.span
              animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
              transition={{ duration: 1.1, repeat: Infinity }}
              className="h-[10px] w-[10px] shrink-0 rounded-full"
              style={{ background: "var(--error, #e11d48)" }}
            />
            <div className="font-mono text-[14px] tabular-nums" style={{ color: "var(--foreground)" }}>
              {Math.floor(elapsed / 60)}:{Math.floor(elapsed % 60).toString().padStart(2, "0")}
            </div>
            <div className="flex flex-1 items-center gap-[2px] overflow-hidden">
              {Array.from({ length: 28 }).map((_, i) => (
                <motion.span
                  key={i}
                  animate={{ height: [`${6 + ((i * 7) % 14)}px`, `${10 + ((i * 11) % 18)}px`, `${6 + ((i * 7) % 14)}px`] }}
                  transition={{ duration: 0.7 + (i % 5) * 0.1, repeat: Infinity, delay: i * 0.03 }}
                  style={{ width: 2, borderRadius: 2, background: "var(--accent)" }}
                />
              ))}
            </div>
            <motion.div
              animate={{ x: [0, -6, 0] }}
              transition={{ duration: 1.4, repeat: Infinity }}
              className="flex items-center gap-[6px] text-[12px]"
              style={{
                color: cancelProgress > 0.5 ? "var(--error, #e11d48)" : "var(--foreground-50)",
                opacity: 1 - cancelProgress * 0.4,
              }}
            >
              <Trash2 size={14} />
              <span className="hidden sm:inline">{t("messenger.swipeCancel")}</span>
              <span className="sm:hidden">{t("messenger.swipeCancelShort")}</span>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <motion.button
        whileTap={{ scale: 0.92 }}
        animate={recording ? { scale: 1.15 } : { scale: 1 }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => recording && stop(true)}
        onContextMenu={(e) => e.preventDefault()}
        className="relative z-30 grid h-[42px] w-[42px] shrink-0 touch-none place-items-center rounded-full select-none"
        style={{
          background: recording ? "var(--error, #e11d48)" : "var(--accent)",
          color: "white",
          transform: recording ? `translateX(${dx}px)` : undefined,
          boxShadow: recording
            ? "0 0 0 6px color-mix(in oklab, var(--error, #e11d48) 25%, transparent)"
            : "0 4px 12px -2px color-mix(in oklab, var(--accent) 50%, transparent)",
          transition: "background 0.15s, box-shadow 0.15s",
          touchAction: "none",
        }}
        aria-label={t("messenger.holdToRecord")}
        title={t("messenger.holdToRecordTitle")}
      >
        <Mic size={18} />
      </motion.button>
    </>
  );
}
