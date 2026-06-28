import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { PhoneOff, Phone, Mic, MicOff, Video, VideoOff } from "lucide-react";
import { toast } from "sonner";
import { useCalls, calls, formatCallDuration, onCallEvent, type CallStatus } from "@/lib/calls";
import { GUEST_USER, useStore, selectors } from "@/lib/store";

const STATUS_LABEL: Record<CallStatus, string> = {
  ringing: "Вызов…",
  connecting: "Соединение…",
  connected: "В разговоре",
  ended: "Звонок завершён",
};

export function CallScreen() {
  const active = useCalls((s) => s.active);
  const me = useStore(selectors.currentUser);
  const [elapsed, setElapsed] = useState(0);

  // Subscribe to the personal signaling channel once we know who we are.
  useEffect(() => {
    if (me?.id && me.id !== GUEST_USER.id) void calls.init(me.id);
  }, [me?.id]);

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

  useEffect(() => {
    const unsub = onCallEvent({
      onEnded: (rec) => {
        if (rec.result === "missed") toast.error(`Нет ответа — ${rec.peerName}`);
        else if (rec.result === "answered") toast.success(`Звонок завершён · ${formatCallDuration(rec.durationSec)}`);
        else toast("Звонок завершён");
      },
    });
    return unsub;
  }, []);

  return (
    <AnimatePresence>
      {active && (
        <motion.div
          key={active.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[100] flex flex-col items-center justify-between overflow-hidden"
          style={{
            background:
              "radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--accent) 30%, var(--background)) 0%, var(--background) 60%)",
            color: "var(--foreground)",
            paddingTop: "max(48px, env(safe-area-inset-top))",
            paddingBottom: "max(40px, env(safe-area-inset-bottom))",
          }}
          role="dialog"
          aria-modal="true"
          aria-label="Экран звонка"
        >
          <VideoLayer />
          <RemoteAudio />
          <CallBody elapsed={elapsed} />
          <CallControls />
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function VideoLayer() {
  const active = useCalls((s) => s.active);
  const localStream = useCalls((s) => s.localStream);
  const remoteStream = useCalls((s) => s.remoteStream);
  const cameraOff = useCalls((s) => s.cameraOff);
  const localRef = useRef<HTMLVideoElement>(null);
  const remoteRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (localRef.current && localStream) localRef.current.srcObject = localStream;
  }, [localStream]);
  useEffect(() => {
    const el = remoteRef.current;
    if (!el || !remoteStream) return;
    el.srcObject = remoteStream;
    void el.play().catch(() => {});
  }, [remoteStream]);

  if (active?.media !== "video") return null;

  return (
    <>
      <video
        ref={remoteRef}
        autoPlay
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        style={{ background: "#000", zIndex: 0 }}
      />
      <div
        className="absolute right-4 z-[2] overflow-hidden rounded-[14px]"
        style={{ top: "max(56px, env(safe-area-inset-top))", width: 110, height: 150, border: "2px solid rgba(255,255,255,0.6)", boxShadow: "0 8px 24px rgba(0,0,0,0.4)" }}
      >
        <video ref={localRef} autoPlay playsInline muted className="h-full w-full object-cover" style={{ background: "#111", transform: "scaleX(-1)" }} />
        {cameraOff && (
          <div className="absolute inset-0 grid place-items-center" style={{ background: "rgba(0,0,0,0.7)", color: "white" }}>
            <VideoOff size={20} />
          </div>
        )}
      </div>
      <div className="absolute inset-0" style={{ zIndex: 1, background: "linear-gradient(to bottom, rgba(0,0,0,0.35) 0%, transparent 25%, transparent 60%, rgba(0,0,0,0.55) 100%)" }} />
    </>
  );
}

function RemoteAudio() {
  const active = useCalls((s) => s.active);
  const remoteStream = useCalls((s) => s.remoteStream);
  const ref = useRef<HTMLAudioElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el || !remoteStream) return;
    el.srcObject = remoteStream;
    void el.play().catch(() => {});
  }, [remoteStream]);

  if (!active || active.media !== "audio") return null;

  return <audio ref={ref} autoPlay playsInline className="hidden" aria-hidden="true" />;
}

function CallBody({ elapsed }: { elapsed: number }) {
  const active = useCalls((s) => s.active);
  if (!active) return null;
  const isVideoConnected = active.media === "video" && active.status === "connected";
  const statusText = active.status === "connected" ? formatCallDuration(elapsed) : STATUS_LABEL[active.status];

  if (isVideoConnected) {
    return (
      <div className="relative z-[2] flex w-full items-start justify-center px-6 pt-2">
        <div className="rounded-full px-4 py-1.5 text-[14px] font-semibold text-white" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}>
          {active.peerName} · <span className="font-mono">{statusText}</span>
        </div>
      </div>
    );
  }

  const initial = (active.peerName || "?").slice(0, 1).toUpperCase();

  return (
    <div className="relative z-[2] flex flex-1 flex-col items-center justify-center px-6 text-center">
      <div className="text-[12px] uppercase tracking-[0.18em]" style={{ color: "var(--foreground-50)" }}>
        {active.direction === "outgoing" ? "Исходящий" : "Входящий"}
        {active.media === "video" ? " · видео" : ""}
      </div>

      <motion.div
        className="relative mt-4"
        animate={active.status === "ringing" || active.status === "connecting" ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="absolute inset-0 rounded-full" style={{ background: "color-mix(in oklab, var(--accent) 30%, transparent)", filter: "blur(28px)" }} />
        {active.peerAvatar ? (
          <img
            src={active.peerAvatar}
            alt=""
            className="relative h-[160px] w-[160px] rounded-full object-cover"
            style={{ boxShadow: "0 12px 40px -8px rgba(0,0,0,0.45)", border: "4px solid var(--background-elevated)" }}
          />
        ) : (
          <div
            className="relative grid h-[160px] w-[160px] place-items-center rounded-full font-display text-[56px] font-bold text-white"
            style={{ background: "var(--accent)", boxShadow: "0 12px 40px -8px rgba(0,0,0,0.45)", border: "4px solid var(--background-elevated)" }}
          >
            {initial}
          </div>
        )}
      </motion.div>

      <h2 className="mt-6 font-display text-[26px] font-bold leading-tight">{active.peerName}</h2>
      <div
        className="mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium"
        style={{
          background: "color-mix(in oklab, var(--background-elevated) 70%, transparent)",
          color: active.status === "connected" ? "var(--success)" : "var(--foreground-70)",
          backdropFilter: "blur(10px)",
        }}
      >
        {active.status === "connected" && <span className="h-[6px] w-[6px] rounded-full" style={{ background: "var(--success)" }} />}
        <span className="font-mono">{statusText}</span>
      </div>
    </div>
  );
}

function CallControls() {
  const active = useCalls((s) => s.active);
  const muted = useCalls((s) => s.muted);
  const cameraOff = useCalls((s) => s.cameraOff);
  if (!active) return null;

  const incomingRinging = active.direction === "incoming" && active.status === "ringing";
  const ended = active.status === "ended";

  if (incomingRinging) {
    return (
      <div className="relative z-[2] flex w-full max-w-md items-center justify-center gap-12 px-6 pb-2">
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => calls.decline()}
            aria-label="Отклонить"
            className="grid h-[68px] w-[68px] place-items-center rounded-full transition-transform active:scale-95"
            style={{ background: "var(--error, #ef4444)", color: "white", boxShadow: "0 12px 30px -6px rgba(239,68,68,0.55)" }}
          >
            <PhoneOff size={26} />
          </button>
          <span className="text-[12px]" style={{ color: "var(--foreground-70)" }}>Отклонить</span>
        </div>
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={() => void calls.accept()}
            aria-label="Принять"
            className="grid h-[68px] w-[68px] place-items-center rounded-full transition-transform active:scale-95"
            style={{ background: "var(--success, #22c55e)", color: "white", boxShadow: "0 12px 30px -6px rgba(34,197,94,0.55)" }}
          >
            <Phone size={26} />
          </button>
          <span className="text-[12px]" style={{ color: "var(--foreground-70)" }}>Принять</span>
        </div>
      </div>
    );
  }

  return (
    <div className="relative z-[2] flex w-full max-w-md items-center justify-center gap-6 px-6 pb-2">
      <ToggleBtn label={muted ? "Включить микрофон" : "Выключить микрофон"} icon={muted ? MicOff : Mic} active={muted} onClick={() => calls.toggleMute()} disabled={ended} />
      <button
        type="button"
        onClick={() => calls.end()}
        disabled={ended}
        aria-label="Завершить звонок"
        className="grid h-[72px] w-[72px] place-items-center rounded-full transition-transform active:scale-95"
        style={{ background: "var(--error, #ef4444)", color: "white", boxShadow: "0 12px 30px -6px rgba(239,68,68,0.55)", opacity: ended ? 0.6 : 1 }}
      >
        <PhoneOff size={28} />
      </button>
      {active.media === "video" ? (
        <ToggleBtn label={cameraOff ? "Включить камеру" : "Выключить камеру"} icon={cameraOff ? VideoOff : Video} active={cameraOff} onClick={() => calls.toggleCamera()} disabled={ended} />
      ) : (
        <div style={{ width: 56 }} />
      )}
    </div>
  );
}

function ToggleBtn({
  icon: Icon,
  label,
  active,
  onClick,
  disabled,
}: {
  icon: typeof Phone;
  label: string;
  active?: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      aria-label={label}
      className="grid h-[56px] w-[56px] place-items-center rounded-full transition-transform active:scale-95"
      style={{
        background: active ? "white" : "color-mix(in oklab, var(--background-elevated) 75%, transparent)",
        color: active ? "#111" : "var(--foreground-70)",
        backdropFilter: "blur(10px)",
        opacity: disabled ? 0.45 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <Icon size={22} />
    </button>
  );
}
