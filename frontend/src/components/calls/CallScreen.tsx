import { useTranslation } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PhoneOff, Phone, MicOff, Video } from "lucide-react";
import { toast } from "sonner";
import { useCalls, calls, formatCallDuration, onCallEvent, type CallStatus } from "@/lib/calls";
import { userById } from "@/lib/mock";

const STATUS_KEYS: Record<CallStatus, string> = {
  ringing: "calls.statusRinging",
  connecting: "calls.statusConnecting",
  connected: "calls.statusConnected",
  ended: "calls.statusEnded",
};

export function CallScreen() {
  const { t } = useTranslation();
  const active = useCalls((s) => s.active);
  const [elapsed, setElapsed] = useState(0);

  // Tick elapsed time while connected
  useEffect(() => {
    if (!active || active.status !== "connected" || !active.connectedAt) {
      setElapsed(0);
      return;
    }
    const update = () => setElapsed(Math.floor((Date.now() - (active.connectedAt as number)) / 1000));
    update();
    const id = setInterval(update, 1000);
    return () => clearInterval(id);
  }, [active?.status, active?.connectedAt, active?.id]);

  // Toast on end
  useEffect(() => {
    const unsub = onCallEvent({
      onEnded: (rec) => {
        const peer = userById(rec.peerId);
        if (rec.result === "missed") toast.error(t("calls.noAnswer", { name: peer.name }));
        else if (rec.result === "answered") toast.success(t("calls.callEndedWith", { duration: formatCallDuration(rec.durationSec) }));
        else toast(t("calls.callEndedShort"));
      },
    });
    return unsub;
  }, [t]);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={active.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-between"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--accent) 30%, var(--background)) 0%, var(--background) 60%)",
            color: "var(--foreground)",
            paddingTop: "max(48px, env(safe-area-inset-top))",
            paddingBottom: "max(40px, env(safe-area-inset-bottom))",
          }}
          role="dialog"
          aria-modal="true"
          aria-label={t("calls.callScreenAria")}
        >
          <CallBody elapsed={elapsed} />
          <CallControls />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function CallBody({ elapsed }: { elapsed: number }) {
  const { t } = useTranslation();
  const active = useCalls((s) => s.active);
  if (!active) return null;
  const peer = userById(active.peerId);
  const statusText =
    active.status === "connected"
      ? formatCallDuration(elapsed)
      : t(STATUS_KEYS[active.status]);

  return (
    <div className="flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="text-[12px] uppercase tracking-[0.18em]" style={{ color: "var(--foreground-50)" }}>
        {active.direction === "outgoing" ? t("calls.outgoing") : t("calls.incoming")}
      </div>

      <motion.div
        className="relative mt-4"
        animate={
          active.status === "ringing" || active.status === "connecting"
            ? { scale: [1, 1.04, 1] }
            : { scale: 1 }
        }
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <span
          className="absolute inset-0 rounded-full"
          style={{
            background: "color-mix(in oklab, var(--accent) 30%, transparent)",
            filter: "blur(28px)",
          }}
        />
        <img
          src={peer.avatar}
          alt=""
          className="relative h-[160px] w-[160px] rounded-full object-cover"
          style={{ boxShadow: "0 12px 40px -8px rgba(0,0,0,0.45)", border: "4px solid var(--background-elevated)" }}
        />
      </motion.div>

      <h2 className="mt-6 font-display text-[26px] font-bold leading-tight">{peer.name}</h2>
      <div
        className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium"
        style={{
          background: "color-mix(in oklab, var(--background-elevated) 70%, transparent)",
          color: active.status === "connected" ? "var(--success)" : "var(--foreground-70)",
          backdropFilter: "blur(10px)",
        }}
      >
        {active.status === "connected" && (
          <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--success)" }} />
        )}
        <span className="font-mono">{statusText}</span>
      </div>
    </div>
  );
}

function CallControls() {
  const { t } = useTranslation();
  const active = useCalls((s) => s.active);
  const ended = active?.status === "ended";
  return (
    <div className="flex w-full max-w-md items-center justify-center gap-6 px-6 pb-2">
      <SecondaryBtn label={t("calls.microphone")} icon={MicOff} disabled />
      <button
        type="button"
        onClick={() => calls.end()}
        disabled={ended}
        aria-label={t("calls.hangup")}
        className="grid h-[72px] w-[72px] place-items-center rounded-full transition-transform active:scale-95"
        style={{
          background: "var(--error, #ef4444)",
          color: "white",
          boxShadow: "0 12px 30px -6px rgba(239,68,68,0.55)",
          opacity: ended ? 0.6 : 1,
        }}
      >
        <PhoneOff size={28} />
      </button>
      <SecondaryBtn label={t("calls.videoBtn")} icon={Video} disabled />
    </div>
  );
}

function SecondaryBtn({ icon: Icon, label, disabled }: { icon: typeof Phone; label: string; disabled?: boolean }) {
  return (
    <button
      type="button"
      disabled={disabled}
      aria-label={label}
      className="grid h-[56px] w-[56px] place-items-center rounded-full"
      style={{
        background: "color-mix(in oklab, var(--background-elevated) 75%, transparent)",
        color: "var(--foreground-70)",
        backdropFilter: "blur(10px)",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <Icon size={22} />
    </button>
  );
}
