import { useTranslation, tStatic } from "@/lib/i18n";
import { PhoneIncoming, PhoneOutgoing, PhoneMissed, Phone, MessageSquare } from "lucide-react";
import { useNavigate } from "@tanstack/react-router";
import { useCalls, calls, formatCallDuration, type CallRecord } from "@/lib/calls";
import { userById } from "@/lib/mock";
import { openOrCreateDialogWith } from "@/lib/store";

function formatWhen(ts: number): string {
  const d = new Date(ts);
  const now = new Date();
  const same = d.toDateString() === now.toDateString();
  const yest = new Date(now);
  yest.setDate(now.getDate() - 1);
  const isYest = d.toDateString() === yest.toDateString();
  const time = d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
  if (same) return tStatic("calls.list.today", { time });
  if (isYest) return tStatic("calls.list.yesterday", { time });
  return d.toLocaleDateString("ru-RU", { day: "2-digit", month: "short" }) + " · " + time;
}

function CallIcon({ rec }: { rec: CallRecord }) {
  if (rec.result === "missed") return <PhoneMissed size={14} style={{ color: "var(--error)" }} />;
  if (rec.direction === "incoming") return <PhoneIncoming size={14} style={{ color: "var(--success)" }} />;
  return <PhoneOutgoing size={14} style={{ color: "var(--accent)" }} />;
}

interface Props {
  onOpenChat: (dialogId: string) => void;
}

export function CallsList({ onOpenChat }: Props) {
  const { t } = useTranslation();
  const history = useCalls((s) => s.history);
  const navigate = useNavigate();

  if (history.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
        <div
          className="grid h-[96px] w-[96px] place-items-center rounded-full"
          style={{ background: "var(--background-surface)", color: "var(--foreground-30)" }}
        >
          <Phone size={36} />
        </div>
        <div className="mt-4 font-display text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>{t("calls.listEmpty")}</div>
        <div className="mt-1 text-[13px]" style={{ color: "var(--foreground-50)" }}>
          {t("calls.listHint")}
        </div>
      </div>
    );
  }

  const sorted = [...history].sort((a, b) => b.startedAt - a.startedAt);

  return (
    <ul>
      {sorted.map((rec) => {
        const peer = userById(rec.peerId);
        const isMissed = rec.result === "missed";
        return (
          <li
            key={rec.id}
            className="flex items-center gap-[12px] px-[16px] py-[12px]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            <img src={peer.avatar} alt="" className="h-[44px] w-[44px] rounded-full object-cover" />
            <div className="min-w-0 flex-1">
              <div
                className="truncate font-display text-[14px] font-semibold"
                style={{ color: isMissed ? "var(--error)" : "var(--foreground)" }}
              >
                {peer.name}
              </div>
              <div className="mt-[2px] flex items-center gap-[6px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                <CallIcon rec={rec} />
                <span>
                  {rec.direction === "incoming" ? t("calls.incoming") : t("calls.outgoing")}
                  {rec.result === "missed" ? t("calls.missedSuffix") : rec.durationSec > 0 ? ` · ${formatCallDuration(rec.durationSec)}` : ""}
                </span>
              </div>
              <div className="mt-[2px] font-mono text-[11px]" style={{ color: "var(--foreground-30)" }}>
                {formatWhen(rec.startedAt)}
              </div>
            </div>
            <div className="flex flex-col gap-[6px]">
              <button
                type="button"
                onClick={() => calls.start(rec.peerId)}
                className="grid h-[36px] w-[36px] place-items-center rounded-full transition-colors"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                aria-label={t("calls.redial")}
                title={t("calls.redial")}
              >
                <Phone size={16} />
              </button>
              <button
                type="button"
                onClick={() => {
                  const did = openOrCreateDialogWith(rec.peerId);
                  onOpenChat(did);
                  navigate({ to: "/messenger", search: { chat: did } });
                }}
                className="grid h-[36px] w-[36px] place-items-center rounded-full transition-colors"
                style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}
                aria-label={t("calls.openChat")}
                title={t("calls.openChat")}
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
