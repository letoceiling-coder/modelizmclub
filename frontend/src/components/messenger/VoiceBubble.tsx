import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Play, Pause, ChevronDown, FileText, Loader2 } from "lucide-react";
import type { VoiceMessage } from "@/lib/mock";
import { transcribeVoiceMedia } from "@/lib/api/chat";
import { isDemoMode } from "@/lib/demo-mode";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

export function VoiceBubble({
  voice,
  isMe,
  onResize,
}: {
  voice: VoiceMessage;
  isMe: boolean;
  onResize?: () => void;
}) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [transcript, setTranscript] = useState(voice.transcript ?? "");
  const [loadingTranscript, setLoadingTranscript] = useState(false);
  const [panelHeight, setPanelHeight] = useState(0);
  const contentRef = useRef<HTMLDivElement>(null);
  // "idle" until fetched; then whether STT is wired and whether speech was found.
  const [transcriptStatus, setTranscriptStatus] = useState<"idle" | "ok" | "empty" | "unavailable">(
    voice.transcript ? "ok" : "idle",
  );
  const raf = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const startProgRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const hasAudio = Boolean(voice.src);

  useEffect(() => {
    if (!hasAudio) return;
    const audio = new Audio(voice.src);
    audioRef.current = audio;
    const onTime = () => {
      const dur = audio.duration && isFinite(audio.duration) ? audio.duration : voice.duration;
      setProgress(dur > 0 ? Math.min(1, audio.currentTime / dur) : 0);
    };
    const onEnd = () => {
      setPlaying(false);
      setProgress(0);
    };
    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("ended", onEnd);
    return () => {
      audio.pause();
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("ended", onEnd);
      audioRef.current = null;
    };
  }, [voice.src, voice.duration, hasAudio]);

  useEffect(() => {
    if (!expanded || transcript || !voice.mediaUuid || transcriptStatus !== "idle") return;
    let alive = true;
    setLoadingTranscript(true);
    transcribeVoiceMedia(voice.mediaUuid)
      .then((res) => {
        if (!alive) return;
        if (!res.available) {
          setTranscriptStatus("unavailable");
        } else if (res.text) {
          setTranscript(res.text);
          setTranscriptStatus("ok");
        } else {
          setTranscriptStatus("empty");
        }
      })
      .finally(() => {
        if (alive) setLoadingTranscript(false);
      });
    return () => {
      alive = false;
    };
  }, [expanded, transcript, voice.mediaUuid, transcriptStatus]);

  const toggle = () => {
    if (hasAudio) {
      const audio = audioRef.current;
      if (!audio) return;
      if (playing) {
        audio.pause();
        setPlaying(false);
      } else {
        void audio.play().then(() => setPlaying(true)).catch(() => setPlaying(false));
      }
      return;
    }
    setPlaying((p) => !p);
  };

  useEffect(() => {
    if (hasAudio || !playing) return;
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
  }, [playing, hasAudio, progress, voice.duration]);

  const fg = isMe ? "white" : "var(--foreground)";
  const subtle = isMe ? "rgba(255,255,255,0.6)" : "var(--foreground-50)";
  const trackBg = isMe ? "rgba(255,255,255,0.35)" : "var(--foreground-30)";
  const playedBg = isMe ? "white" : "var(--accent)";
  const buttonBg = isMe ? "rgba(255,255,255,0.18)" : "var(--accent-soft)";

  const unavailableText = "Расшифровка недоступна — распознавание речи подключается на сервере.";
  const transcriptText = transcript
    || (loadingTranscript ? "Загрузка расшифровки…" : "")
    || (transcriptStatus === "empty" ? "Речь не распознана." : "")
    || (transcriptStatus === "unavailable" ? unavailableText : "")
    || (expanded && !voice.mediaUuid && !isDemoMode() ? unavailableText : "")
    || (expanded && isDemoMode() ? "Тестовая расшифровка голосового сообщения." : "");

  const measurePanel = useCallback(() => {
    const el = contentRef.current;
    if (!el) return;
    setPanelHeight(el.scrollHeight);
  }, []);

  useLayoutEffect(() => {
    if (!expanded) {
      setPanelHeight(0);
      return;
    }
    measurePanel();
    const el = contentRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => {
      measurePanel();
      onResize?.();
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [expanded, measurePanel, transcriptText, loadingTranscript, onResize]);

  useEffect(() => {
    if (expanded) onResize?.();
  }, [expanded, panelHeight, onResize]);

  return (
    <div style={{ minWidth: 220, maxWidth: 280 }}>
      <div className="flex items-center gap-[10px]">
        <button
          onClick={toggle}
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
        className="mt-[8px] flex w-full items-center gap-[6px] rounded-[10px] px-[8px] py-[6px] text-left transition-colors"
        style={{
          background: isMe ? "rgba(255,255,255,0.12)" : "color-mix(in oklab, var(--accent) 8%, transparent)",
          color: fg,
        }}
        aria-expanded={expanded}
      >
        <FileText size={12} style={{ color: subtle, flexShrink: 0 }} />
        <span className="flex-1 text-[12px] font-medium">{expanded ? "Скрыть текст" : "Показать текст"}</span>
        {loadingTranscript && <Loader2 size={12} className="animate-spin shrink-0" style={{ color: subtle }} />}
        <ChevronDown
          size={12}
          style={{ color: subtle, flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        />
      </button>

      <motion.div
        initial={false}
        animate={{ height: expanded ? panelHeight : 0 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
        style={{ overflow: "hidden" }}
      >
        <div ref={contentRef}>
          <div
            className="mt-[6px] rounded-[10px] px-[8px] py-[6px] text-[12px] leading-[1.45]"
            style={{
              background: isMe ? "rgba(255,255,255,0.10)" : "color-mix(in oklab, var(--accent) 6%, transparent)",
              color: transcriptText && !loadingTranscript ? fg : subtle,
              minHeight: expanded && loadingTranscript ? 36 : undefined,
            }}
          >
            {transcriptText || unavailableText}
          </div>
        </div>
      </motion.div>
    </div>
  );
}
