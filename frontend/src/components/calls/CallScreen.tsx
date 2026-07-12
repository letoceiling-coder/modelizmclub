import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { PhoneOff, Phone, Mic, MicOff, Video, VideoOff, SwitchCamera, Volume2, VolumeX } from "lucide-react";
import { toast } from "@/lib/toast";
import { useCalls, calls, formatCallDuration, onCallEvent, type CallStatus } from "@/lib/calls";
import { GUEST_USER, useStore, selectors } from "@/lib/store";

const STATUS_LABEL: Record<CallStatus, string> = {
  ringing: "Вызов…",
  connecting: "Соединение…",
  connected: "В разговоре",
  reconnecting: "Переподключение…",
  ended: "Звонок завершён",
};

export function CallScreen() {
  const active = useCalls((s) => s.active);
  const me = useStore(selectors.currentUser);
  const [elapsed, setElapsed] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);

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
        else if (rec.result === "rejected") toast.error(`Звонок отклонён — ${rec.peerName}`);
        else if (rec.result === "busy") toast.error(`Занято — ${rec.peerName}`);
        else if (rec.result === "answered") toast.success(`Звонок завершён · ${formatCallDuration(rec.durationSec)}`);
        else toast("Звонок завершён");
      },
    });
    return unsub;
  }, []);

  if (!mounted) return null;

  return createPortal(
    <AnimatePresence>
      {active && (
        <motion.div
          key={active.id}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-[9999] flex flex-col overflow-hidden"
          style={{
            height: "100dvh",
            background:
              "radial-gradient(circle at 50% 0%, color-mix(in oklab, var(--accent) 30%, var(--background)) 0%, var(--background) 60%)",
            color: "var(--foreground)",
            paddingTop: "max(12px, env(safe-area-inset-top))",
            paddingBottom: "max(12px, env(safe-area-inset-bottom))",
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
    </AnimatePresence>,
    document.body,
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
        data-call-media
        autoPlay
        playsInline
        className="absolute inset-0 h-full w-full object-cover"
        style={{ background: "#000", zIndex: 0 }}
      />
      <div
        className="absolute right-4 z-[2] overflow-hidden rounded-[var(--r-card)]"
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

  return <audio ref={ref} data-call-media autoPlay playsInline className="hidden" aria-hidden="true" />;
}

function CallBody({ elapsed }: { elapsed: number }) {
  const active = useCalls((s) => s.active);
  if (!active) return null;
  const isVideoConnected = active.media === "video" && active.status === "connected";
  const statusText = active.status === "connected" ? formatCallDuration(elapsed) : STATUS_LABEL[active.status];
  const incomingRinging = active.direction === "incoming" && active.status === "ringing";

  if (isVideoConnected) {
    return (
      <div className="relative z-[2] flex w-full shrink-0 items-start justify-center px-6 pt-2">
        <div className="rounded-full px-4 py-1.5 text-[14px] font-semibold text-white" style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(8px)" }}>
          {active.peerName} · <span className="font-mono">{statusText}</span>
        </div>
      </div>
    );
  }

  const initial = (active.peerName || "?").slice(0, 1).toUpperCase();

  return (
    <div
      className={`relative z-[2] flex min-h-0 flex-1 flex-col items-center justify-center px-6 text-center ${incomingRinging ? "pb-2" : ""}`}
    >
      <div className="text-[12px] uppercase tracking-[0.18em]" style={{ color: "var(--foreground-50)" }}>
        {active.direction === "outgoing" ? "Исходящий" : "Входящий"}
        {active.media === "video" ? " · видео" : ""}
      </div>

      <motion.div
        className="relative mt-3 sm:mt-4"
        animate={active.status === "ringing" || active.status === "connecting" ? { scale: [1, 1.04, 1] } : { scale: 1 }}
        transition={{ duration: 1.4, repeat: Infinity, ease: "easeInOut" }}
      >
        <span className="absolute inset-0 rounded-full" style={{ background: "color-mix(in oklab, var(--accent) 30%, transparent)", filter: "blur(28px)" }} />
        {active.peerAvatar ? (
          <img
            src={active.peerAvatar}
            alt=""
            className="relative h-[120px] w-[120px] sm:h-[160px] sm:w-[160px] rounded-full object-cover"
            style={{ boxShadow: "0 12px 40px -8px rgba(0,0,0,0.45)", border: "4px solid var(--background-elevated)" }}
          />
        ) : (
          <div
            className="relative grid h-[120px] w-[120px] sm:h-[160px] sm:w-[160px] place-items-center rounded-full font-display text-[44px] sm:text-[56px] font-bold text-white"
            style={{ background: "var(--accent)", boxShadow: "0 12px 40px -8px rgba(0,0,0,0.45)", border: "4px solid var(--background-elevated)" }}
          >
            {initial}
          </div>
        )}
      </motion.div>

      <h2 className="mt-4 sm:mt-6 font-display text-[22px] sm:text-[26px] font-bold leading-tight">{active.peerName}</h2>
      <div
        className="mt-2 sm:mt-3 inline-flex items-center gap-2 rounded-full px-4 py-1.5 text-[13px] font-medium"
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
  const speakerOn = useCalls((s) => s.speakerOn);
  const canSwitchCamera = useCalls((s) => s.canSwitchCamera);
  if (!active) return null;

  const incomingRinging = active.direction === "incoming" && active.status === "ringing";
  const ended = active.status === "ended";

  if (incomingRinging) {
    return (
      <div
        className="relative z-[10] shrink-0 w-full px-6"
        style={{ paddingBottom: "max(8px, env(safe-area-inset-bottom))" }}
      >
        <div className="mx-auto grid max-w-md grid-cols-2 gap-8 sm:gap-12">
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => calls.decline()}
              aria-label="Отклонить"
              className="grid h-[72px] w-[72px] place-items-center rounded-full transition-transform active:scale-95 touch-manipulation"
              style={{ background: "var(--error, var(--danger))", color: "white", boxShadow: "0 12px 30px -6px rgba(239,68,68,0.55)" }}
            >
              <PhoneOff size={28} />
            </button>
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Отклонить</span>
          </div>
          <div className="flex flex-col items-center gap-2">
            <button
              type="button"
              onClick={() => void calls.accept()}
              aria-label="Принять"
              className="grid h-[72px] w-[72px] place-items-center rounded-full transition-transform active:scale-95 touch-manipulation"
              style={{ background: "var(--success, #22c55e)", color: "white", boxShadow: "0 12px 30px -6px rgba(34,197,94,0.55)" }}
            >
              <Phone size={28} />
            </button>
            <span className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Принять</span>
          </div>
        </div>
      </div>
    );
  }

  const isVideo = active.media === "video";

  return (
    <div
      className="relative z-[10] shrink-0 flex w-full max-w-md flex-col items-center gap-4 px-6 mx-auto"
      style={{ paddingBottom: "max(4px, env(safe-area-inset-bottom))" }}
    >
      <div className="flex items-center justify-center gap-3 flex-wrap">
        <ToggleBtn
          label={muted ? "Включить микрофон" : "Выключить микрофон"}
          icon={muted ? MicOff : Mic}
          active={muted}
          onClick={() => calls.toggleMute()}
          disabled={ended}
        />
        <ToggleBtn
          label={speakerOn ? "Выключить звук собеседника" : "Включить звук собеседника"}
          icon={speakerOn ? Volume2 : VolumeX}
          active={!speakerOn}
          onClick={() => void calls.toggleSpeaker()}
          disabled={ended}
        />
        {isVideo && (
          <ToggleBtn
            label={cameraOff ? "Включить камеру" : "Выключить камеру"}
            icon={cameraOff ? VideoOff : Video}
            active={cameraOff}
            onClick={() => calls.toggleCamera()}
            disabled={ended}
          />
        )}
        {isVideo && canSwitchCamera && (
          <ToggleBtn
            label="Сменить камеру"
            icon={SwitchCamera}
            onClick={() => void calls.switchCamera()}
            disabled={ended || cameraOff}
          />
        )}
      </div>
      <button
        type="button"
        onClick={() => calls.end()}
        disabled={ended}
        aria-label="Завершить звонок"
        className="grid h-[72px] w-[72px] place-items-center rounded-full transition-transform active:scale-95 touch-manipulation"
        style={{ background: "var(--error, var(--danger))", color: "white", boxShadow: "0 12px 30px -6px rgba(239,68,68,0.55)", opacity: ended ? 0.6 : 1 }}
      >
        <PhoneOff size={28} />
      </button>
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
      className="grid h-[56px] w-[56px] place-items-center rounded-full transition-transform active:scale-95 touch-manipulation"
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
