import { useEffect, useState } from "react";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Phone, Video, MessageSquare } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { calls } from "@/lib/calls";
import { fetchCallHistory, type ApiCallRecord } from "@/lib/api/calls";
import { openOrCreateDialogWith } from "@/lib/store";

function formatWhen(iso: string): string {
  const d = new Date(iso);
  const now = new Date();
  const same = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (same) return `Сегодня · ${time}`;
  if (isYest) return `Вчера · ${time}`;
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) + " · " + time;
}

function fmtDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

function CallIcon({ rec }: { rec: ApiCallRecord }) {
  const missed = rec.status === "missed" || rec.status === "rejected";
  if (missed) return <PhoneMissed size={14} style={{ color: "var(--error)" }} />;
  if (rec.direction === "incoming") return <PhoneIncoming size={14} style={{ color: "var(--success)" }} />;
  return <PhoneOutgoing size={14} style={{ color: "var(--accent)" }} />;
}

interface Props {
  onOpenChat: (dialogId: string) => void;
}

export function CallsList({ onOpenChat }: Props) {
  const navigate = useNavigate();
  const [history, setHistory] = useState<ApiCallRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchCallHistory()
      .then(setHistory)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (!loading && history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div
          className="grid h-[96px] w-[96px] place-items-center rounded-full"
          style={{ background: "var(--background-surface)", color: "var(--foreground-30)" }}
        >
          <Phone size={36} />
        </div>
        <div className="mt-4 font-display text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>
          Пока нет звонков
        </div>
        <div className="mt-1 text-[13px]" style={{ color: "var(--foreground-50)" }}>
          Совершите вызов из любого диалога
        </div>
      </div>
    );
  }

  return (
    <ul>
      {history.map((rec) => {
        const isMissed = rec.status === "missed" || rec.status === "rejected";
        const initial = (rec.peer.name || "?").slice(0, 1).toUpperCase();
        return (
          <li
            key={rec.uuid}
            className="flex items-center gap-[12px] px-[16px] py-[12px]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {rec.peer.avatar ? (
              <img src={rec.peer.avatar} alt="" className="h-[44px] w-[44px] rounded-full object-cover" />
            ) : (
              <div className="grid h-[44px] w-[44px] place-items-center rounded-full font-display text-[16px] font-bold text-[var(--accent-foreground)]" style={{ background: "var(--accent)" }}>
                {initial}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <div
                className="truncate font-display text-[14px] font-semibold"
                style={{ color: isMissed ? "var(--error)" : "var(--foreground)" }}
              >
                {rec.peer.name}
              </div>
              <div className="mt-[2px] flex items-center gap-[6px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                <CallIcon rec={rec} />
                {rec.media === "video" && <Video size={12} style={{ color: "var(--foreground-50)" }} />}
                <span>
                  {rec.direction === "incoming" ? "Входящий" : "Исходящий"}
                  {isMissed ? " · пропущен" : rec.duration > 0 ? ` · ${fmtDuration(rec.duration)}` : ""}
                </span>
              </div>
              <div className="mt-[2px] font-mono text-[11px]" style={{ color: "var(--foreground-30)" }}>
                {formatWhen(rec.started_at)}
              </div>
            </div>
            <div className="flex flex-col gap-[6px]">
              <button
                type="button"
                onClick={() => void calls.start(rec.peer.uuid, rec.peer.name, rec.peer.avatar ?? undefined, rec.media)}
                className="grid h-[36px] w-[36px] place-items-center rounded-full transition-colors"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                aria-label="Перезвонить"
                title="Перезвонить"
              >
                <Phone size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const did = openOrCreateDialogWith(rec.peer.uuid);
                  onOpenChat(did);
                  navigate({ to: "/messenger", search: { chat: did } });
                }}
                className="grid h-[36px] w-[36px] place-items-center rounded-full transition-colors"
                style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}
                aria-label="Открыть чат"
                title="Открыть чат"
              >
                <MessageSquare size={16} />
              </button>
            </div>
          </li>
        );
      })}
    </ul>
  );
}
