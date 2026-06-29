import { toast } from "sonner";
// Exposes the same module-store API the call UI already consumes.

import { useSyncExternalStore } from "react";
import {
  fetchIceServers,
  initiateCall,
  answerCall,
  sendIce,
  rejectCall,
  hangupCall,
  fetchIncomingCall,
} from "./api/calls";
import { getToken } from "./api/client";
import { GUEST_USER } from "./store";
import { subscribeCalls, onEchoConnection } from "./realtime/echo";

export type CallStatus = "ringing" | "connecting" | "connected" | "ended";
export type CallDirection = "outgoing" | "incoming";
export type CallResult = "answered" | "missed" | "ended";
export type CallMedia = "audio" | "video";

export interface ActiveCall {
  id: string; // backend call uuid (or a temp id before it is assigned)
  peerId: string; // peer user uuid
  peerName: string;
  peerAvatar?: string;
  direction: CallDirection;
  media: CallMedia;
  status: CallStatus;
  startedAt: number;
  connectedAt?: number;
  endedAt?: number;
  result?: CallResult;
}

export interface CallRecord {
  id: string;
  peerId: string;
  peerName: string;
  peerAvatar?: string;
  direction: CallDirection;
  media: CallMedia;
  startedAt: number;
  durationSec: number;
  result: CallResult;
}

interface CallsState {
  active: ActiveCall | null;
  muted: boolean;
  cameraOff: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
}

const RING_TIMEOUT_MS = 35_000;
const AUTO_DISMISS_MS = 1500;

let state: CallsState = {
  active: null,
  muted: false,
  cameraOff: false,
  localStream: null,
  remoteStream: null,
};

const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnap = (): CallsState => state;

function setState(patch: Partial<CallsState>): void {
  state = { ...state, ...patch };
  emit();
}
function patchActive(patch: Partial<ActiveCall>): void {
  if (!state.active) return;
  state = { ...state, active: { ...state.active, ...patch } };
  emit();
}

export interface CallListener {
  onEnded?: (record: CallRecord) => void;
}
const callListeners = new Set<CallListener>();
export function onCallEvent(l: CallListener): () => void {
  callListeners.add(l);
  return () => callListeners.delete(l);
}

// ---- engine internals ----
let pc: RTCPeerConnection | null = null;
let myUuid: string | null = null;
let incomingOffer: RTCSessionDescriptionInit | null = null;
let remoteDescSet = false;
let pendingCandidates: RTCIceCandidateInit[] = [];
let ringTimer: ReturnType<typeof setTimeout> | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
let signalUnsub: (() => void) | null = null;
let initGen = 0;
let pendingLocalCandidates: RTCIceCandidateInit[] = [];
let incomingPollTimer: ReturnType<typeof setInterval> | null = null;
let echoConnUnsub: (() => void) | null = null;

/** Only when WebSocket is down — not for every online user. */
const INCOMING_POLL_MS = 30_000;

function pollIncomingOnce(): void {
  if (state.active && state.active.status !== "ended") return;
  fetchIncomingCall()
    .then((offer) => {
      if (offer) void handleSignal(offer);
    })
    .catch(() => {});
}

/** One-shot HTTP check for a ringing call (after reconnect / tab wake). */
export function syncIncomingOffer(): void {
  pollIncomingOnce();
}

function startDisconnectedPoll(): void {
  if (incomingPollTimer) return;
  pollIncomingOnce();
  incomingPollTimer = setInterval(pollIncomingOnce, INCOMING_POLL_MS);
}

function stopIncomingPoll(): void {
  if (incomingPollTimer) {
    clearInterval(incomingPollTimer);
    incomingPollTimer = null;
  }
}

function syncIncomingFallback(connected: boolean): void {
  if (connected) {
    stopIncomingPoll();
    // One catch-up after reconnect (missed events while socket was down).
    pollIncomingOnce();
  } else {
    startDisconnectedPoll();
  }
}

export function shutdownCalls(): void {
  stopIncomingPoll();
  if (echoConnUnsub) {
    echoConnUnsub();
    echoConnUnsub = null;
  }
  initGen++;
  if (signalUnsub) {
    signalUnsub();
    signalUnsub = null;
  }
}

function clearTimers(): void {
  if (ringTimer) clearTimeout(ringTimer);
  if (dismissTimer) clearTimeout(dismissTimer);
  ringTimer = null;
  dismissTimer = null;
}

async function buildPc(): Promise<RTCPeerConnection> {
  const iceServers = await fetchIceServers();
  const conn = new RTCPeerConnection({ iceServers });
  const remote = new MediaStream();
  setState({ remoteStream: remote });

  conn.onicecandidate = (ev) => {
    if (!ev.candidate) return;
    const cand = ev.candidate.toJSON();
    const callId = state.active?.id;
    if (callId && !callId.startsWith("pending_")) {
      void sendIce(callId, cand).catch(() => {});
    } else {
      pendingLocalCandidates.push(cand);
    }
  };
  conn.ontrack = (ev) => {
    ev.streams[0]?.getTracks().forEach((t) => remote.addTrack(t));
    if (ev.streams.length === 0) remote.addTrack(ev.track);
  };
  conn.onconnectionstatechange = () => {
    const s = conn.connectionState;
    if (s === "connected") {
      if (state.active && state.active.status !== "connected") {
        patchActive({ status: "connected", connectedAt: Date.now() });
        if (ringTimer) {
          clearTimeout(ringTimer);
          ringTimer = null;
        }
      }
    } else if (s === "failed" || s === "closed") {
      finish("ended");
    }
  };
  return conn;
}

async function getMedia(media: CallMedia): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: true,
    video: media === "video" ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } } : false,
  });
  setState({ localStream: stream, muted: false, cameraOff: false });
  return stream;
}

async function drainCandidates(): Promise<void> {
  if (!pc) return;
  for (const c of pendingCandidates) {
    try {
      await pc.addIceCandidate(c);
    } catch {
      /* ignore */
    }
  }
  pendingCandidates = [];
}

function recordFrom(active: ActiveCall, result: CallResult): CallRecord {
  const durationSec =
    active.connectedAt && result === "answered"
      ? Math.max(0, Math.round((Date.now() - active.connectedAt) / 1000))
      : 0;
  return {
    id: active.id,
    peerId: active.peerId,
    peerName: active.peerName,
    peerAvatar: active.peerAvatar,
    direction: active.direction,
    media: active.media,
    startedAt: active.startedAt,
    durationSec,
    result,
  };
}

function teardownMedia(): void {
  state.localStream?.getTracks().forEach((t) => t.stop());
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.onconnectionstatechange = null;
    try {
      pc.close();
    } catch {
      /* ignore */
    }
  }
  pc = null;
  incomingOffer = null;
  remoteDescSet = false;
  pendingCandidates = [];
  pendingLocalCandidates = [];
}

function flushPendingLocalIce(callId: string): void {
  if (!callId || callId.startsWith("pending_")) return;
  for (const c of pendingLocalCandidates) {
    void sendIce(callId, c).catch(() => {});
  }
  pendingLocalCandidates = [];
}

/** Close the call locally, emit a history record and auto-dismiss the screen. */
function finish(result: CallResult): void {
  const active = state.active;
  if (!active || active.status === "ended") {
    teardownMedia();
    return;
  }
  clearTimers();
  const wasConnected = active.status === "connected" && !!active.connectedAt;
  const finalResult: CallResult = wasConnected
    ? "answered"
    : active.direction === "incoming"
      ? "missed"
      : result === "answered"
        ? "answered"
        : "ended";
  const record = recordFrom(active, finalResult);

  teardownMedia();

  setState({
    active: { ...active, status: "ended", endedAt: Date.now(), result: finalResult },
    localStream: null,
    remoteStream: null,
  });
  callListeners.forEach((l) => l.onEnded?.(record));

  dismissTimer = setTimeout(() => setState({ active: null }), AUTO_DISMISS_MS);
}

async function handleSignal(payload: { type: string; [k: string]: any }): Promise<void> {
  const type = payload.type;

  if (type === "offer") {
    // Ignore a second incoming call while busy — tell the caller we are busy.
    if (state.active && state.active.status !== "ended") {
      void rejectCall(payload.call_uuid).catch(() => {});
      return;
    }
    clearTimers();
    incomingOffer = payload.sdp as RTCSessionDescriptionInit;
    const from = payload.from ?? {};
    setState({
      active: {
        id: payload.call_uuid,
        peerId: from.uuid ?? "",
        peerName: from.name ?? "Пользователь",
        peerAvatar: from.avatar ?? undefined,
        direction: "incoming",
        media: payload.media === "video" ? "video" : "audio",
        status: "ringing",
        startedAt: Date.now(),
      },
    });
    ringTimer = setTimeout(() => finish("missed"), RING_TIMEOUT_MS);
    const label = from.name ?? "Пользователь";
    toast.info(`Входящий звонок — ${label}`, {
      duration: 8000,
      action: { label: "Принять", onClick: () => void calls.accept() },
    });
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([300, 120, 300]);
    }
    return;
  }

  if (!state.active || state.active.id !== payload.call_uuid) return;

  if (type === "answer") {
    if (!pc) return;
    patchActive({ status: "connecting" });
    try {
      await pc.setRemoteDescription(payload.sdp as RTCSessionDescriptionInit);
      remoteDescSet = true;
      await drainCandidates();
    } catch {
      finish("ended");
    }
  } else if (type === "ice") {
    const cand = payload.candidate as RTCIceCandidateInit;
    if (pc && remoteDescSet) {
      try {
        await pc.addIceCandidate(cand);
      } catch {
        /* ignore */
      }
    } else {
      pendingCandidates.push(cand);
    }
  } else if (type === "reject" || type === "hangup" || type === "busy") {
    finish(type === "hangup" ? "ended" : "missed");
  }
}

export function ingestCallSignal(payload: { type: string; [k: string]: unknown }): void {
  void handleSignal(payload as { type: string; [k: string]: any });
}

export const calls = {
  /** Subscribe to the personal call-signaling channel. Safe to call after Echo reset. */
  async init(userUuid: string): Promise<void> {
    if (!userUuid || userUuid === GUEST_USER.id) return;
    if (!getToken()) return;

    const gen = ++initGen;
    if (signalUnsub) {
      signalUnsub();
      signalUnsub = null;
    }
    myUuid = userUuid;

    const unsub = await subscribeCalls(userUuid, (p) => void handleSignal(p));
    if (gen !== initGen) {
      unsub();
      return;
    }
    signalUnsub = unsub;
    if (!echoConnUnsub) {
      echoConnUnsub = onEchoConnection(syncIncomingFallback);
    }
  },

  async start(
    peerUuid: string,
    peerName = "Пользователь",
    peerAvatar?: string,
    media: CallMedia = "audio",
  ): Promise<void> {
    if (state.active && state.active.status !== "ended") return;
    clearTimers();
    setState({
      active: {
        id: `pending_${Date.now()}`,
        peerId: peerUuid,
        peerName,
        peerAvatar,
        direction: "outgoing",
        media,
        status: "ringing",
        startedAt: Date.now(),
      },
    });
    try {
      const stream = await getMedia(media);
      pc = await buildPc();
      stream.getTracks().forEach((t) => pc!.addTrack(t, stream));
      const offer = await pc.createOffer();
      await pc.setLocalDescription(offer);
      const callUuid = await initiateCall({ to: peerUuid, media, sdp: offer });
      patchActive({ id: callUuid });
      flushPendingLocalIce(callUuid);
      ringTimer = setTimeout(() => finish("missed"), RING_TIMEOUT_MS);
    } catch {
      finish("ended");
    }
  },

  async accept(): Promise<void> {
    const active = state.active;
    if (!active || active.direction !== "incoming" || !incomingOffer) return;
    clearTimers();
    patchActive({ status: "connecting" });
    try {
      const stream = await getMedia(active.media);
      pc = await buildPc();
      stream.getTracks().forEach((t) => pc!.addTrack(t, stream));
      await pc.setRemoteDescription(incomingOffer);
      remoteDescSet = true;
      await drainCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await answerCall(active.id, answer);
    } catch {
      finish("ended");
    }
  },

  decline(): void {
    const active = state.active;
    if (!active) return;
    void rejectCall(active.id).catch(() => {});
    finish("ended");
  },

  end(): void {
    const active = state.active;
    if (!active || active.status === "ended") return;
    void hangupCall(active.id).catch(() => {});
    finish(active.status === "connected" ? "answered" : "ended");
  },

  dismiss(): void {
    clearTimers();
    setState({ active: null });
  },

  toggleMute(): void {
    const stream = state.localStream;
    if (!stream) return;
    const next = !state.muted;
    stream.getAudioTracks().forEach((t) => (t.enabled = !next));
    setState({ muted: next });
  },

  toggleCamera(): void {
    const stream = state.localStream;
    if (!stream) return;
    const next = !state.cameraOff;
    stream.getVideoTracks().forEach((t) => (t.enabled = !next));
    setState({ cameraOff: next });
  },
};

export function useCalls<T>(selector: (s: CallsState) => T): T {
  const snap = useSyncExternalStore(subscribe, getSnap, getSnap);
  return selector(snap);
}

export function formatCallDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
