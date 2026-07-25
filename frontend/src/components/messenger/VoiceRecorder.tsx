import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, Mic, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";

const MAX_SECONDS = 180;
const CANCEL_THRESHOLD = 72;

function pickMimeType(): string {
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  if (typeof MediaRecorder === "undefined") return "";
  return candidates.find((t) => MediaRecorder.isTypeSupported(t)) ?? "";
}

export function VoiceRecorder({ onSend }: { onSend: (blob: Blob, durationSec: number) => void }) {
  const [recording, setRecording] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [dx, setDx] = useState(0);
  const [canceling, setCanceling] = useState(false);

  const startX = useRef<number | null>(null);
  const startTime = useRef<number>(0);
  const timer = useRef<number | null>(null);
  const cancelTimer = useRef<number | null>(null);
  const canceledRef = useRef(false);
  const cancelingRef = useRef(false);
  const recordingRef = useRef(false);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const startingRef = useRef(false);

  const teardownStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    recorderRef.current = null;
  };

  const stop = useCallback((cancel: boolean) => {
    if (cancelTimer.current) {
      window.clearTimeout(cancelTimer.current);
      cancelTimer.current = null;
    }
    if (timer.current) {
      window.clearInterval(timer.current);
      timer.current = null;
    }

    const dur = Math.max(1, Math.round((performance.now() - startTime.current) / 1000));
    const shouldSend = !cancel && !canceledRef.current;

    recordingRef.current = false;
    cancelingRef.current = false;
    setRecording(false);
    setCanceling(false);
    setDx(0);
    startX.current = null;
    setElapsed(0);

    const recorder = recorderRef.current;
    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" });
        chunksRef.current = [];
        teardownStream();
        if (shouldSend && blob.size > 0) onSend(blob, Math.min(MAX_SECONDS, dur));
      };
      recorder.stop();
    } else {
      chunksRef.current = [];
      teardownStream();
    }
    canceledRef.current = false;
  }, [onSend]);

  const playCancelAnimation = useCallback(() => {
    if (canceledRef.current || cancelingRef.current) return;
    canceledRef.current = true;
    cancelingRef.current = true;
    setCanceling(true);
    setDx(-CANCEL_THRESHOLD);
    cancelTimer.current = window.setTimeout(() => stop(true), 260);
  }, [stop]);

  const handlePointerMove = useCallback((clientX: number) => {
    if (!recordingRef.current || startX.current === null || cancelingRef.current) return;
    const delta = Math.min(0, clientX - startX.current);
    setDx(delta);
    if (delta <= -CANCEL_THRESHOLD) playCancelAnimation();
  }, [playCancelAnimation]);

  const handlePointerEnd = useCallback(() => {
    if (startingRef.current && !recordingRef.current) {
      canceledRef.current = true;
      return;
    }
    if (!recordingRef.current || cancelingRef.current) return;
    stop(canceledRef.current);
  }, [stop]);

  useEffect(() => {
    if (!recording) return;

    const onMove = (e: PointerEvent) => handlePointerMove(e.clientX);
    const onEnd = () => handlePointerEnd();

    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onEnd);
    window.addEventListener("pointercancel", onEnd);
    return () => {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onEnd);
      window.removeEventListener("pointercancel", onEnd);
    };
  }, [recording, handlePointerMove, handlePointerEnd]);

  const begin = async (clientX: number) => {
    if (startingRef.current || recordingRef.current) return;
    startingRef.current = true;
    canceledRef.current = false;
    cancelingRef.current = false;
    setCanceling(false);
    startX.current = clientX;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (canceledRef.current) {
        stream.getTracks().forEach((t) => t.stop());
        startingRef.current = false;
        startX.current = null;
        return;
      }

      const mimeType = pickMimeType();
      const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
      chunksRef.current = [];
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };
      recorder.start();
      streamRef.current = stream;
      recorderRef.current = recorder;

      startTime.current = performance.now();
      setElapsed(0);
      setDx(0);
      recordingRef.current = true;
      setRecording(true);

      timer.current = window.setInterval(() => {
        const sec = (performance.now() - startTime.current) / 1000;
        if (sec >= MAX_SECONDS) {
          setElapsed(MAX_SECONDS);
          stop(false);
        } else {
          setElapsed(sec);
        }
      }, 100);
    } catch {
      startX.current = null;
      toast.error("Нет доступа к микрофону", { description: "Разрешите запись звука в браузере" });
    } finally {
      startingRef.current = false;
    }
  };

  const onPointerDown = (ev: React.PointerEvent<HTMLButtonElement>) => {
    ev.preventDefault();
    ev.currentTarget.setPointerCapture(ev.pointerId);
    void begin(ev.clientX);
  };

  useEffect(
    () => () => {
      if (timer.current) window.clearInterval(timer.current);
      if (cancelTimer.current) window.clearTimeout(cancelTimer.current);
      teardownStream();
    },
    [],
  );

  const cancelProgress = Math.min(1, Math.abs(dx) / CANCEL_THRESHOLD);
  const cancelReady = cancelProgress >= 0.92 || canceling;
  const micShift = canceling ? -CANCEL_THRESHOLD : dx;

  return (
    <>
      <AnimatePresence>
        {recording && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{
              opacity: canceling ? 0 : 1,
              y: 0,
              x: canceling ? -40 : dx * 0.18,
            }}
            exit={{ opacity: 0, y: 8, x: -24 }}
            transition={{ duration: canceling ? 0.22 : 0.18 }}
            className="absolute inset-y-0 left-0 z-20 flex min-w-0 items-center gap-[8px] px-[10px] sm:gap-[10px] sm:px-[12px]"
            style={{
              right: 52,
              background: "var(--background)",
              borderTop: "1px solid var(--border)",
            }}
          >
            <span
              className="h-[10px] w-[10px] shrink-0 rounded-full"
              style={{
                background: "var(--error, #e11d48)",
                animation: cancelReady ? "none" : "voice-rec-pulse 1.1s ease-in-out infinite",
                opacity: cancelReady ? 0.45 : 1,
              }}
            />

            <span
              className="shrink-0 font-mono text-[14px] tabular-nums"
              style={{
                color: "var(--foreground)",
                opacity: 1 - cancelProgress * 0.5,
                transition: "opacity 80ms linear",
              }}
            >
              {Math.floor(elapsed / 60)}:{Math.floor(elapsed % 60).toString().padStart(2, "0")}
            </span>

            <div
              className="flex min-w-0 flex-1 items-center gap-[2px]"
              style={{
                opacity: 1 - cancelProgress * 0.55,
                transform: `scale(${1 - cancelProgress * 0.04})`,
                transition: "opacity 80ms linear, transform 80ms linear",
              }}
            >
              {Array.from({ length: 32 }).map((_, i) => (
                <span
                  key={i}
                  className="min-w-[2px] flex-1 rounded-[2px]"
                  style={{
                    height: cancelReady ? 6 : `${6 + ((i * 7) % 14)}px`,
                    background: cancelReady ? "var(--error, #e11d48)" : "var(--accent)",
                    animation: cancelReady ? "none" : `voice-rec-bar ${0.55 + (i % 5) * 0.08}s ease-in-out ${i * 0.03}s infinite alternate`,
                    transition: "height 120ms ease, background 120ms ease",
                  }}
                />
              ))}
            </div>

            <div
              className="relative hidden min-w-0 shrink overflow-hidden rounded-full sm:block"
              style={{ maxWidth: 168 }}
            >
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{
                  width: `${Math.max(6, cancelProgress * 100)}%`,
                  background: "color-mix(in oklab, var(--error, #e11d48) 22%, transparent)",
                  transition: cancelProgress > 0 ? "width 60ms linear" : "none",
                }}
              />
              <div
                className="relative flex items-center gap-[5px] px-[10px] py-[5px] text-[12px] font-medium"
                style={{
                  color: cancelReady ? "var(--error, #e11d48)" : cancelProgress > 0.3 ? "rgb(185,28,28)" : "var(--foreground-50)",
                  transform: `translateX(${dx * 0.35}px) scale(${1 + cancelProgress * 0.06})`,
                  transition: cancelProgress > 0 ? "transform 60ms linear, color 120ms ease" : "color 120ms ease",
                }}
              >
                <Trash2
                  size={14}
                  className="shrink-0"
                  style={{
                    transform: `rotate(${-10 * cancelProgress}deg) scale(${1 + cancelProgress * 0.2})`,
                    transition: "transform 60ms linear",
                  }}
                />
                <span className="truncate">{cancelReady ? "Отмена…" : "Свайп влево для отмены"}</span>
              </div>
            </div>

            <div
              className="flex shrink-0 items-center gap-[2px] sm:hidden"
              style={{
                color: cancelReady ? "var(--error, #e11d48)" : "var(--foreground-50)",
                opacity: 0.55 + cancelProgress * 0.45,
                transform: `translateX(${dx * 0.35}px)`,
                transition: "transform 60ms linear, opacity 80ms linear, color 120ms ease",
              }}
            >
              <ChevronLeft size={14} className="shrink-0" />
              <Trash2 size={14} className="shrink-0" />
              <span className="text-[11px] font-medium">{cancelReady ? "Отмена" : "Отмена"}</span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <button
        type="button"
        onPointerDown={onPointerDown}
        onContextMenu={(e) => e.preventDefault()}
        className="relative z-30 grid h-[44px] w-[44px] shrink-0 touch-none place-items-center rounded-full select-none sm:h-[42px] sm:w-[42px]"
        style={{
          background: recording
            ? cancelReady ? "rgb(127,29,29)" : "var(--error, #e11d48)"
            : "var(--accent)",
          color: "white",
          transform: recording ? `translateX(${micShift}px) scale(${canceling ? 0.9 : 1.08 + cancelProgress * 0.06})` : undefined,
          boxShadow: recording
            ? `0 0 0 ${6 + cancelProgress * 12}px color-mix(in oklab, var(--error, #e11d48) ${20 + cancelProgress * 30}%, transparent)`
            : "0 4px 12px -2px color-mix(in oklab, var(--accent) 50%, transparent)",
          transition: recording ? "box-shadow 80ms linear, background 120ms ease" : "background 0.15s, box-shadow 0.15s, transform 0.15s",
          touchAction: "none",
        }}
        aria-label="Удерживайте для записи голосового"
        title="Удерживайте для записи"
      >
        <Mic
          size={18}
          style={{
            opacity: canceling ? 0 : 1,
            transform: canceling ? "scale(0.7) rotate(-15deg)" : undefined,
            transition: "opacity 180ms ease, transform 180ms ease",
          }}
        />
      </button>

      <style>{`
        @keyframes voice-rec-pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.25); opacity: 0.55; }
        }
        @keyframes voice-rec-bar {
          from { transform: scaleY(0.65); }
          to { transform: scaleY(1.15); }
        }
      `}</style>
    </>
  );
}
