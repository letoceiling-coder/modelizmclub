import { useCallback, useEffect, useRef, useState } from "react";
import { Play, Pause, ChevronDown, FileText, Loader2 } from "lucide-react";
import type { VoiceMessage } from "@/lib/mock";
import { transcribeVoiceMedia } from "@/lib/api/chat";
import { isDemoMode } from "@/lib/demo-mode";

function fmt(s: number): string {
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, "0")}`;
}

function TranscriptSkeleton({ subtle }: { subtle: string }) {
  return (
    <div className="flex flex-col gap-[6px] py-[2px]" aria-hidden="true">
      <span className="h-[10px] w-[92%] animate-pulse rounded-[4px]" style={{ background: subtle, opacity: 0.35 }} />
      <span className="h-[10px] w-[68%] animate-pulse rounded-[4px]" style={{ background: subtle, opacity: 0.25 }} />
    </div>
  );
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
  const [transcriptStatus, setTranscriptStatus] = useState<"idle" | "ok" | "empty" | "unavailable">(
    voice.transcript ? "ok" : "idle",
  );
  const raf = useRef<number | null>(null);
  const startRef = useRef<number>(0);
  const startProgRef = useRef<number>(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const resizeRaf = useRef<number | null>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const gridTransitioning = useRef(false);
  const hasAudio = Boolean(voice.src);
  const needsFetch = Boolean(voice.mediaUuid) && !voice.transcript && transcriptStatus === "idle";

  const notifyResize = useCallback(() => {
    if (!onResize) return;
    if (resizeRaf.current) cancelAnimationFrame(resizeRaf.current);
    resizeRaf.current = requestAnimationFrame(() => {
      resizeRaf.current = null;
      onResize();
    });
  }, [onResize]);

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

  useEffect(() => {
    if (!expanded || !onResize || !panelRef.current || typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(() => {
      if (gridTransitioning.current) return;
      notifyResize();
    });
    ro.observe(panelRef.current);
    return () => ro.disconnect();
  }, [expanded, onResize, notifyResize]);

  const toggleTranscript = () => {
    setExpanded((open) => {
      const next = !open;
      if (next && needsFetch && !transcript) {
        setLoadingTranscript(true);
      }
      if (!next) setLoadingTranscript(false);
      return next;
    });
  };

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
  const demoText = "Тестовая расшифровка голосового сообщения.";
  const showSkeleton = expanded && loadingTranscript;
  const transcriptBody = transcript
    || (transcriptStatus === "empty" ? "Речь не распознана." : "")
    || (transcriptStatus === "unavailable" ? unavailableText : "")
    || (expanded && !voice.mediaUuid && !isDemoMode() ? unavailableText : "")
    || (expanded && isDemoMode() ? demoText : "");

  const handleGridTransitionStart = () => {
    gridTransitioning.current = true;
  };

  const handleGridTransitionEnd = (e: React.TransitionEvent<HTMLDivElement>) => {
    if (e.propertyName !== "grid-template-rows") return;
    gridTransitioning.current = false;
    notifyResize();
  };

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
        onClick={toggleTranscript}
        className="mt-[8px] flex w-full items-center gap-[6px] rounded-[10px] px-[8px] py-[6px] text-left transition-colors"
        style={{
          background: isMe ? "rgba(255,255,255,0.12)" : "color-mix(in oklab, var(--accent) 8%, transparent)",
          color: fg,
        }}
        aria-expanded={expanded}
      >
        <FileText size={12} style={{ color: subtle, flexShrink: 0 }} />
        <span className="flex-1 text-[12px] font-medium">{expanded ? "Скрыть текст" : "Показать текст"}</span>
        {showSkeleton && <Loader2 size={12} className="animate-spin shrink-0" style={{ color: subtle }} />}
        <ChevronDown
          size={12}
          style={{ color: subtle, flexShrink: 0, transform: expanded ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}
        />
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
        style={{ gridTemplateRows: expanded ? "1fr" : "0fr" }}
        onTransitionStart={handleGridTransitionStart}
        onTransitionEnd={handleGridTransitionEnd}
      >
        <div className="min-h-0 overflow-hidden">
          <div
            ref={panelRef}
            className="mt-[6px] rounded-[10px] px-[8px] py-[8px] text-[12px] leading-[1.45] transition-[min-height,opacity] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)]"
            style={{
              background: isMe ? "rgba(255,255,255,0.10)" : "color-mix(in oklab, var(--accent) 6%, transparent)",
              color: transcriptBody && !showSkeleton ? fg : subtle,
              opacity: expanded ? 1 : 0,
              minHeight: expanded ? (showSkeleton ? 52 : undefined) : 0,
            }}
          >
            {showSkeleton ? (
              <TranscriptSkeleton subtle={subtle} />
            ) : (
              transcriptBody || unavailableText
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
