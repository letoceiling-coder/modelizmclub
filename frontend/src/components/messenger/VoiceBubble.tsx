import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Play, Pause, ChevronDown, FileText } from "lucide-react";
import type { VoiceMessage } from "@/lib/mock";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function VoiceBubble({ voice, isMe }: { voice: VoiceMessage; isMe: boolean }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0); // 0..1
  const [expanded, setExpanded] = useState(false);
  const raf = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const startProgRef = useRef<number>(0);

  useEffect(() => {
    if (!playing) return;
    startRef.current = performance.now();
    startProgRef.current = progress >= 1 ? 0 : progress;
    if (progress >= 1) setProgress(0);
    const tick = (t: number) => {
      const elapsed = (t - startRef.current) / 1000;
      const p = Math.min(1, startProgRef.current + elapsed / voice.duration);
      setProgress(p);
      if (p >= 1) {
        setPlaying(false);
        return;
      }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => {
      if (raf.current) cancelAnimationFrame(raf.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [playing]);

  const fg = isMe ? "white" : "var(--foreground)";
  const subtle = isMe ? "rgba(255,255,255,0.6)" : "var(--foreground-50)";
  const trackBg = isMe ? "rgba(255,255,255,0.35)" : "var(--foreground-30)";
  const playedBg = isMe ? "white" : "var(--accent)";
  const buttonBg = isMe ? "rgba(255,255,255,0.18)" : "var(--accent-soft)";

  const previewLimit = 60;
  const isLong = voice.transcript.length > previewLimit;
  const preview = isLong ? voice.transcript.slice(0, previewLimit).trimEnd() + "…" : voice.transcript;

  return (
    <div style={{ minWidth: 220, maxWidth: 280 }}>
      <div className="flex items-center gap-[10px]">
        <button
          onClick={() => setPlaying((p) => !p)}
          className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full transition-transform active:scale-95"
          style={{ background: buttonBg, color: fg }}
          aria-label={playing ? "Пауза" : "Воспроизвести"}
        >
          {playing ? <Pause size={16} /> : <Play size={16} style={{ marginLeft: 2 }} />}
        </button>
        <div className="flex flex-1 flex-col gap-[4px]">
          <div className="flex h-[28px] items-center gap-[2px]">
            {voice.waveform.map((h, i) => {
              const played = i / voice.waveform.length <= progress;
              return (
                <span
                  key={i}
                  style={{
                    width: 2,
                    height: `${Math.round(h * 24) + 4}px`,
                    borderRadius: 2,
                    background: played ? playedBg : trackBg,
                    transition: "background 0.1s",
                  }}
                />
              );
            })}
          </div>
          <div className="flex items-center justify-between font-mono text-[10px]" style={{ color: subtle }}>
            <span>{fmt(playing || progress > 0 ? voice.duration * progress : voice.duration)}</span>
            <span>голосовое</span>
          </div>
        </div>
      </div>

      <button
        onClick={() => setExpanded((e) => !e)}
        className="mt-[8px] flex w-full items-start gap-[6px] rounded-[10px] px-[8px] py-[6px] text-left transition-colors"
        style={{
          background: isMe ? "rgba(255,255,255,0.12)" : "color-mix(in oklab, var(--accent) 8%, transparent)",
          color: fg,
        }}
      >
        <FileText size={12} style={{ marginTop: 2, color: subtle, flexShrink: 0 }} />
        <div className="flex-1 text-[12px] leading-[1.4]">
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={expanded ? "full" : "preview"}
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.18 }}
              style={{ overflow: "hidden" }}
            >
              {expanded ? voice.transcript : preview}
            </motion.div>
          </AnimatePresence>
        </div>
        {isLong && (
          <ChevronDown
            size={12}
            style={{
              marginTop: 2,
              color: subtle,
              flexShrink: 0,
              transform: expanded ? "rotate(180deg)" : "none",
              transition: "transform 0.2s",
            }}
          />
        )}
      </button>
    </div>
  );
}
