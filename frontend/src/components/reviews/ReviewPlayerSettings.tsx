import { useEffect, useRef, useState } from "react";
import { Settings2 } from "lucide-react";
import { useTranslation } from "react-i18next";

const PREFS_KEY = "modelizm:review-player-prefs";

export interface ReviewPlayerPrefs {
  speed: number;
}

const SPEEDS = [0.5, 0.75, 1, 1.25, 1.5, 2] as const;

export function readReviewPlayerPrefs(): ReviewPlayerPrefs {
  if (typeof window === "undefined") return { speed: 1 };
  try {
    const raw = window.localStorage.getItem(PREFS_KEY);
    if (!raw) return { speed: 1 };
    const parsed = JSON.parse(raw) as Partial<ReviewPlayerPrefs>;
    const speed = typeof parsed.speed === "number" ? parsed.speed : 1;
    return { speed: SPEEDS.includes(speed as (typeof SPEEDS)[number]) ? speed : 1 };
  } catch {
    return { speed: 1 };
  }
}

function writeReviewPlayerPrefs(prefs: ReviewPlayerPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

interface Props {
  videoRef: React.RefObject<HTMLVideoElement | null>;
  visible: boolean;
}

export function ReviewPlayerSettings({ videoRef, visible }: Props) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [speed, setSpeed] = useState(() => readReviewPlayerPrefs().speed);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = videoRef.current;
    if (el) el.playbackRate = speed;
  }, [speed, videoRef, visible]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!visible) return null;

  const setPlaybackSpeed = (next: number) => {
    setSpeed(next);
    writeReviewPlayerPrefs({ speed: next });
    const el = videoRef.current;
    if (el) el.playbackRate = next;
  };

  return (
    <div ref={panelRef} className="absolute bottom-[52px] right-[10px] z-10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={t("components.reviewPlayer.settings")}
        aria-expanded={open}
        className="grid h-[36px] w-[36px] place-items-center rounded-full transition-opacity hover:opacity-90"
        style={{ background: "rgba(0,0,0,0.65)", color: "#fff" }}
      >
        <Settings2 size={18} />
      </button>
      {open && (
        <div
          className="absolute bottom-[44px] right-0 min-w-[200px] rounded-[12px] border p-[12px] shadow-lg"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
        >
          <div className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-50)" }}>
            {t("components.reviewPlayer.quality")}
          </div>
          <div className="mt-[6px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
            {t("components.reviewPlayer.qualityAuto")}
          </div>
          <div className="mt-[12px] text-[11px] font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-50)" }}>
            {t("components.reviewPlayer.speed")}
          </div>
          <div className="mt-[6px] flex flex-wrap gap-[6px]">
            {SPEEDS.map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setPlaybackSpeed(s)}
                className="rounded-[8px] px-[10px] py-[5px] text-[12px] font-medium transition-colors"
                style={{
                  background: speed === s ? "var(--accent-soft)" : "var(--background-surface)",
                  color: speed === s ? "var(--accent)" : "var(--foreground-70)",
                  border: `1px solid ${speed === s ? "var(--border-accent)" : "var(--border)"}`,
                }}
              >
                {s === 1 ? t("components.reviewPlayer.speedNormal") : `${s}×`}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
