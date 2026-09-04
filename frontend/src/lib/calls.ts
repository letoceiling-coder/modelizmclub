import { toast } from "@/lib/toast";
// Exposes the same module-store API the call UI already consumes.

import { useSyncExternalStore } from "react";
import {
  fetchIceServers,
  initiateCall,
  answerCall,
  restartCall,
  sendIce,
  rejectCall,
  hangupCall,
  fetchIncomingCall,
} from "./api/calls";
import { getToken } from "./api/client";
import { GUEST_USER } from "./store";
import { subscribeCalls, onEchoConnection } from "./realtime/echo";
import { initLogger, logEvent, setLogCall } from "./logger";
import { handleGroupInvite } from "./groupCall";

/** One RTCStatsReport row — the spec types it as a bag of optional fields. */
type StatsEntry = {
  type?: string;
  id?: string;
  selected?: boolean;
  nominated?: boolean;
  state?: string;
  localCandidateId?: string;
  remoteCandidateId?: string;
  bytesReceived?: number;
  [k: string]: unknown;
};
import {
  bindCallAudioUnlock,
  unlockCallAudio,
  startRingback,
  startRingtone,
  stopCallSounds,
  stopRingLoop,
  playConnecting,
  playConnected,
  playDisconnected,
  playBusy,
  playRejected,
} from "./callAudio";

export type CallStatus = "ringing" | "connecting" | "connected" | "reconnecting" | "ended";
export type CallDirection = "outgoing" | "incoming";
export type CallResult = "answered" | "missed" | "ended" | "rejected" | "busy";
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
  speakerOn: boolean;
  canSwitchCamera: boolean;
  canSwitchSpeaker: boolean;
  localStream: MediaStream | null;
  remoteStream: MediaStream | null;
  /** Bumped when remote MediaStream tracks change — same object ref otherwise skips React updates. */
  remoteStreamGen: number;
}

const RING_TIMEOUT_MS = 35_000;
const AUTO_DISMISS_MS = 1500;

let state: CallsState = {
  active: null,
  muted: false,
  cameraOff: false,
  speakerOn: true,
  canSwitchCamera: false,
  canSwitchSpeaker: false,
  localStream: null,
  remoteStream: null,
  remoteStreamGen: 0,
};

let currentFacing: "user" | "environment" = "user";

/** setSinkId is the only standard way to route audio output; absent on iOS Safari. */
function speakerRoutingSupported(): boolean {
  return (
    typeof HTMLMediaElement !== "undefined" &&
    typeof (HTMLMediaElement.prototype as { setSinkId?: unknown }).setSinkId === "function"
  );
}

const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};
const getSnap = (): CallsState => state;

function setState(patch: Partial<CallsState>): void {
  state = { ...state, ...patch };
  if (patch.active !== undefined) setLogCall(patch.active?.id);
  emit();
}
function patchActive(patch: Partial<ActiveCall>): void {
  if (!state.active) return;
  const prevStatus = state.active.status;
  state = { ...state, active: { ...state.active, ...patch } };
  if (patch.id) setLogCall(patch.id);
  if (patch.status && patch.status !== prevStatus) {
    // The ring loop (гудки / мелодия) must only sound while "ringing".
    if (patch.status !== "ringing") {
      stopRingLoop();
      // Negotiation has begun — the "no answer" timeout must not kill the call.
      if (ringTimer) {
        clearTimeout(ringTimer);
        ringTimer = null;
      }
    }
    logEvent("info", "calls", `status ${prevStatus} -> ${patch.status}`);
  }
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
let applyingAnswer = false;
let pendingCandidates: RTCIceCandidateInit[] = [];
let ringTimer: ReturnType<typeof setTimeout> | null = null;
let dismissTimer: ReturnType<typeof setTimeout> | null = null;
let signalUnsub: (() => void) | null = null;
let initGen = 0;
let pendingLocalCandidates: RTCIceCandidateInit[] = [];
let incomingPollTimer: ReturnType<typeof setInterval> | null = null;
let echoConnUnsub: (() => void) | null = null;
/** Set when a terminal signal ends the call before initiateCall HTTP returns. */
let outgoingEndedDuringPending = false;

// ---- reconnection / stability (ported from agent.neeklo.ru rtc-runtime) ----
let reconnectAttempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let disconnectGraceTimer: ReturnType<typeof setTimeout> | null = null;
let mediaWatchdogTimer: ReturnType<typeof setInterval> | null = null;
let renegotiating = false;
let lastMediaActivityAt = 0;
let lastInboundBytes = 0;

const RECONNECT_MAX_ATTEMPTS = 8;
const RECONNECT_BASE_DELAY_MS = 1_000;
const RECONNECT_MAX_DELAY_MS = 30_000;
const DISCONNECT_GRACE_MS = 6_000;
const MEDIA_STALL_MS = 25_000;
const MEDIA_CHECK_MS = 4_000;

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
  stopCallSounds();
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

/** Verbose call tracing — console + remote diagnostic logger. */
function clog(...args: unknown[]): void {
  // eslint-disable-next-line no-console
  console.log("%c[calls]", "color:#e85d2a;font-weight:bold", ...args);
  const [head, ...rest] = args;
  const msg = typeof head === "string" ? head : String(head);
  logEvent("debug", "calls", msg, rest.length ? rest : undefined);
}

/** Snapshot the selected ICE candidate pair (types/protocol) for diagnosis. */
async function logSelectedPair(reason: string): Promise<void> {
  if (!pc) return;
  try {
    const stats = await pc.getStats();
    const rows: StatsEntry[] = [];
    stats.forEach((r: StatsEntry) => rows.push(r));
    const pair =
      rows.find(
        (r) =>
          r.type === "candidate-pair" && (r.selected || r.nominated) && r.state === "succeeded",
      ) ?? null;
    const local = pair ? (rows.find((r) => r.id === pair.localCandidateId) ?? null) : null;
    const remote = pair ? (rows.find((r) => r.id === pair.remoteCandidateId) ?? null) : null;
    logEvent("info", "calls", `ice pair (${reason})`, {
      ice: pc.iceConnectionState,
      conn: pc.connectionState,
      localType: local?.candidateType,
      localProto: local?.protocol,
      remoteType: remote?.candidateType,
      remoteProto: remote?.protocol,
      rtt: pair?.currentRoundTripTime,
    });
  } catch {
    /* ignore */
  }
}

/** Surface the real failure instead of silently ending the call. */
function reportCallError(where: string, err: unknown): void {
  const e = err as { name?: string; message?: string } | undefined;
  let msg = e?.message ?? "Неизвестная ошибка";
  switch (e?.name) {
    case "NotAllowedError":
    case "SecurityError":
      msg = "Доступ к микрофону/камере запрещён. Разрешите доступ в браузере.";
      break;
    case "NotFoundError":
    case "OverconstrainedError":
      msg = "Микрофон или камера не найдены.";
      break;
    case "NotReadableError":
      msg = "Микрофон/камера заняты другим приложением.";
      break;
  }
  // eslint-disable-next-line no-console
  console.error(`[calls:${where}]`, e?.name ?? "", err);
  logEvent("error", "calls", `error @ ${where}`, { name: e?.name, message: e?.message });
  toast.error(`Звонок: ${msg}`);
}

async function buildPc(): Promise<RTCPeerConnection> {
  const iceServers = await fetchIceServers();
  const conn = new RTCPeerConnection({
    iceServers,
    bundlePolicy: "max-bundle",
    rtcpMuxPolicy: "require",
    iceCandidatePoolSize: 2,
  });
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
    pokeMedia();
    setState({ remoteStreamGen: state.remoteStreamGen + 1 });
  };
  conn.oniceconnectionstatechange = () => {
    clog("iceConnectionState ->", conn.iceConnectionState);
    onIceState(conn.iceConnectionState);
  };
  conn.onconnectionstatechange = () => {
    const s = conn.connectionState;
    clog("connectionState ->", s);
    if (s === "connected") {
      markConnected();
    } else if (s === "closed") {
      const status = state.active?.status;
      if (status && status !== "ended") finish("ended");
    }
    // NOTE: "failed" is handled by oniceconnectionstatechange via ICE restart —
    // we do NOT end the call here (that was the instability bug).
  };
  return conn;
}

function markConnected(): void {
  clearReconnectTimers();
  reconnectAttempts = 0;
  renegotiating = false;
  if (state.active && state.active.status !== "connected") {
    patchActive({ status: "connected", connectedAt: state.active.connectedAt ?? Date.now() });
    playConnected();
  } else if (state.active) {
    patchActive({ status: "connected" });
  }
  if (ringTimer) {
    clearTimeout(ringTimer);
    ringTimer = null;
  }
  startMediaWatchdog();
  void logSelectedPair("connected");
}

function onIceState(ice: RTCIceConnectionState): void {
  if (!state.active || state.active.status === "ended") return;
  // While still ringing (callee hasn't answered) ICE has no remote side yet.
  if (state.active.status === "ringing" && ice !== "connected" && ice !== "completed") return;
  if (ice === "connected" || ice === "completed") {
    markConnected();
  } else if (ice === "disconnected") {
    // Transient — give it a grace window before forcing an ICE restart.
    patchActive({ status: "reconnecting" });
    if (disconnectGraceTimer) clearTimeout(disconnectGraceTimer);
    disconnectGraceTimer = setTimeout(() => {
      const cur = pc?.iceConnectionState;
      if (cur === "connected" || cur === "completed") return;
      scheduleIceRestart();
    }, DISCONNECT_GRACE_MS);
  } else if (ice === "failed") {
    patchActive({ status: "reconnecting" });
    void logSelectedPair("ice-failed");
    scheduleIceRestart();
  }
}

function clearReconnectTimers(): void {
  if (reconnectTimer) {
    clearTimeout(reconnectTimer);
    reconnectTimer = null;
  }
  if (disconnectGraceTimer) {
    clearTimeout(disconnectGraceTimer);
    disconnectGraceTimer = null;
  }
}

/** Exponential backoff ICE restart (1s, 2s, 4s … up to 30s, max 8 tries). */
function scheduleIceRestart(): void {
  if (!state.active || state.active.status === "ended") return;
  if (reconnectAttempts >= RECONNECT_MAX_ATTEMPTS) {
    finish("ended");
    return;
  }
  if (reconnectTimer) clearTimeout(reconnectTimer);
  const delay = Math.min(RECONNECT_BASE_DELAY_MS * 2 ** reconnectAttempts, RECONNECT_MAX_DELAY_MS);
  reconnectAttempts += 1;
  reconnectTimer = setTimeout(() => void performIceRestart(), delay);
}

/** Create a fresh ICE-restart offer and relay it to the peer for renegotiation. */
async function performIceRestart(): Promise<void> {
  if (!pc || !state.active || state.active.status === "ended") return;
  if (renegotiating) return;
  if (state.active.id.startsWith("pending_")) return;
  renegotiating = true;
  patchActive({ status: "reconnecting" });
  try {
    const wantVideo = state.active.media === "video";
    const offer = await pc.createOffer({
      iceRestart: true,
      offerToReceiveAudio: true,
      offerToReceiveVideo: wantVideo,
    });
    await pc.setLocalDescription(offer);
    await restartCall(state.active.id, offer);
  } catch {
    renegotiating = false;
    scheduleIceRestart();
  }
}

function pokeMedia(): void {
  lastMediaActivityAt = Date.now();
}

function startMediaWatchdog(): void {
  stopMediaWatchdog();
  lastMediaActivityAt = Date.now();
  lastInboundBytes = 0;
  mediaWatchdogTimer = setInterval(() => {
    void checkMediaAlive();
  }, MEDIA_CHECK_MS);
}

function stopMediaWatchdog(): void {
  if (mediaWatchdogTimer) {
    clearInterval(mediaWatchdogTimer);
    mediaWatchdogTimer = null;
  }
}

/** Detect frozen media (no inbound bytes) on a "connected" PC → trigger ICE restart. */
async function checkMediaAlive(): Promise<void> {
  if (!pc || !state.active || state.active.status === "ended") return;
  const remote = state.remoteStream;
  const hasLive = remote?.getTracks().some((t) => t.readyState === "live" && t.enabled);
  if (!hasLive) return;
  try {
    const stats = await pc.getStats();
    let inbound = 0;
    stats.forEach((r: StatsEntry) => {
      if (r.type === "inbound-rtp") inbound += r.bytesReceived ?? 0;
    });
    if (inbound > lastInboundBytes) {
      lastInboundBytes = inbound;
      lastMediaActivityAt = Date.now();
      return;
    }
  } catch {
    return;
  }
  if (Date.now() - lastMediaActivityAt > MEDIA_STALL_MS && !renegotiating) {
    lastMediaActivityAt = Date.now();
    void performIceRestart();
  }
}

/** Try opening the camera with progressively looser constraints. */
async function tryAcquireVideoTrack(): Promise<MediaStreamTrack | null> {
  const attempts: Array<MediaTrackConstraints | boolean> = [
    { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
    { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } },
    { facingMode: "user" },
    { width: { ideal: 640 }, height: { ideal: 480 } },
    true,
  ];
  for (const video of attempts) {
    try {
      const probe = await navigator.mediaDevices.getUserMedia({ audio: false, video });
      const track = probe.getVideoTracks()[0];
      if (track) return track;
      probe.getTracks().forEach((t) => t.stop());
    } catch {
      /* try next constraint set */
    }
  }
  return null;
}

function attachLocalMedia(stream: MediaStream | null, media: CallMedia): void {
  if (!pc) return;
  if (stream) {
    stream.getTracks().forEach((t) => {
      if (!pc!.getSenders().some((s) => s.track === t)) pc!.addTrack(t, stream);
    });
  }
  if (media === "video" && !pc.getSenders().some((s) => s.track?.kind === "video")) {
    pc.addTransceiver("video", { direction: "recvonly" });
  }
}

/** Renegotiate after adding/removing a local track mid-call. */
async function performRenegotiation(): Promise<void> {
  if (!pc || !state.active || state.active.status === "ended") return;
  if (renegotiating) return;
  if (state.active.id.startsWith("pending_")) return;
  renegotiating = true;
  try {
    const wantVideo = state.active.media === "video";
    const offer = await pc.createOffer({
      offerToReceiveAudio: true,
      offerToReceiveVideo: wantVideo,
    });
    await pc.setLocalDescription(offer);
    await restartCall(state.active.id, offer);
  } catch {
    renegotiating = false;
  }
}

/**
 * Acquire local media with graceful degradation:
 *  1) full (audio + video for video calls)
 *  2) audio-only local send if the camera is missing/busy/blocked — call stays video
 *  3) null (receive-only) if there is no microphone either —
 *     the call still connects and this side can hear/see the peer.
 */
async function getMedia(media: CallMedia): Promise<MediaStream | null> {
  const wantVideo = media === "video";
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: true,
      video: wantVideo
        ? { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } }
        : false,
    });
    currentFacing = "user";
    setState({
      localStream: stream,
      muted: false,
      cameraOff: false,
      canSwitchSpeaker: speakerRoutingSupported(),
    });
    if (wantVideo) void detectMultipleCameras();
    return stream;
  } catch (err) {
    const name = (err as { name?: string })?.name ?? "";
    clog("getMedia: full failed (", name, ")");
    if (wantVideo) {
      try {
        const audioOnly = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
        const videoTrack = await tryAcquireVideoTrack();
        if (videoTrack) {
          audioOnly.addTrack(videoTrack);
          currentFacing = "user";
          setState({
            localStream: audioOnly,
            muted: false,
            cameraOff: false,
            canSwitchSpeaker: speakerRoutingSupported(),
          });
          void detectMultipleCameras();
          return audioOnly;
        }
        toast.info("Камера недоступна — вы всё равно увидите собеседника");
        setState({
          localStream: audioOnly,
          muted: false,
          cameraOff: true,
          canSwitchSpeaker: speakerRoutingSupported(),
        });
        return audioOnly;
      } catch (errAudio) {
        const nameAudio = (errAudio as { name?: string })?.name ?? "";
        if (nameAudio === "NotFoundError" || name === "NotFoundError") {
          clog("getMedia: no input devices — receive-only mode");
          toast.info("Нет микрофона/камеры — режим только приёма");
          setState({
            localStream: null,
            muted: true,
            cameraOff: true,
            canSwitchSpeaker: speakerRoutingSupported(),
          });
          return null;
        }
        throw errAudio;
      }
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      setState({
        localStream: stream,
        muted: false,
        cameraOff: true,
        canSwitchSpeaker: speakerRoutingSupported(),
      });
      return stream;
    } catch (err2) {
      const name2 = (err2 as { name?: string })?.name ?? "";
      if (name2 === "NotFoundError" || name === "NotFoundError") {
        clog("getMedia: no input devices — receive-only mode");
        toast.info("Нет микрофона/камеры — режим только приёма");
        setState({
          localStream: null,
          muted: true,
          cameraOff: true,
          canSwitchSpeaker: speakerRoutingSupported(),
        });
        return null;
      }
      throw err2;
    }
  }
}

/**
 * Repair SDP line endings. When an offer/answer travels through PHP + JSON +
 * Reverb, the trailing CRLF (or all CRLFs) can be stripped/normalised, which
 * makes Chrome reject the last `a=ssrc:` line with "Invalid SDP line".
 * We rebuild canonical `\r\n` endings and guarantee a trailing CRLF.
 */
function normalizeSdp(
  desc: RTCSessionDescriptionInit | undefined | null,
): RTCSessionDescriptionInit | null {
  if (!desc || typeof desc.sdp !== "string") return (desc as RTCSessionDescriptionInit) ?? null;
  const lines = desc.sdp
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .split("\n")
    .map((l) => l.replace(/\s+$/g, ""))
    .filter((l) => l.length > 0);
  const sdp = lines.join("\r\n") + "\r\n";
  return { type: desc.type, sdp };
}

async function setRemote(desc: RTCSessionDescriptionInit): Promise<void> {
  if (!pc) return;
  const raw = desc?.sdp ?? "";
  clog(
    "setRemote",
    desc?.type,
    "len=",
    raw.length,
    "endsCRLF=",
    raw.endsWith("\r\n"),
    "hasCR=",
    raw.includes("\r"),
  );
  const fixed = normalizeSdp(desc);
  if (!fixed) throw new Error("Empty SDP");
  await pc.setRemoteDescription(fixed);
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
  clearReconnectTimers();
  stopMediaWatchdog();
  reconnectAttempts = 0;
  renegotiating = false;
  state.localStream?.getTracks().forEach((t) => t.stop());
  if (pc) {
    pc.onicecandidate = null;
    pc.ontrack = null;
    pc.oniceconnectionstatechange = null;
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
  applyingAnswer = false;
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
  clog(
    "finish()",
    result,
    "status=",
    active?.status,
    "ice=",
    pc?.iceConnectionState,
    "conn=",
    pc?.connectionState,
  );
  if (!active || active.status === "ended") {
    stopCallSounds();
    teardownMedia();
    return;
  }
  clearTimers();
  const wasConnected = active.status === "connected" && !!active.connectedAt;
  let finalResult: CallResult = result;
  if (wasConnected) {
    finalResult = "answered";
  } else if (result !== "rejected" && result !== "busy") {
    if (active.direction === "incoming") {
      // Explicit decline/timeout — do not mark a user-initiated decline as "missed".
      finalResult = result === "missed" ? "missed" : "ended";
    } else if (result === "answered") {
      finalResult = "answered";
    } else if (result !== "missed") {
      finalResult = "ended";
    }
  }
  const record = recordFrom(active, finalResult);

  stopCallSounds();
  if (finalResult === "busy") playBusy();
  else if (finalResult === "rejected") playRejected();
  else if (wasConnected || finalResult === "answered") playDisconnected();
  else if (finalResult === "ended") playDisconnected();

  teardownMedia();

  setState({
    active: { ...active, status: "ended", endedAt: Date.now(), result: finalResult },
    localStream: null,
    remoteStream: null,
    remoteStreamGen: 0,
    canSwitchCamera: false,
    canSwitchSpeaker: false,
    speakerOn: true,
  });
  callListeners.forEach((l) => l.onEnded?.(record));

  dismissTimer = setTimeout(() => setState({ active: null }), AUTO_DISMISS_MS);
}

// The signal payload is shaped by the server per `type`; each branch below narrows it.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function handleSignal(payload: { type: string; [k: string]: any }): Promise<void> {
  const type = payload.type;
  clog(
    "signal IN",
    type,
    "call=",
    payload.call_uuid,
    "myActive=",
    state.active?.id,
    state.active?.status,
  );

  if (type === "group_invite") {
    handleGroupInvite(
      payload as { room?: string; media?: string; title?: string; from?: { name?: string } },
    );
    return;
  }

  if (type === "offer") {
    // Duplicate delivery (calls.* + user.* channels) — ignore, do not auto-reject.
    if (state.active && state.active.id === payload.call_uuid && state.active.status !== "ended") {
      return;
    }
    // Busy with another active call — signal busy to the new caller.
    if (state.active && state.active.status !== "ended") {
      void rejectCall(payload.call_uuid, "busy").catch(() => {});
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
    unlockCallAudio();
    startRingtone();
    toast.dismiss();
    if (typeof navigator !== "undefined" && navigator.vibrate) {
      navigator.vibrate([300, 120, 300]);
    }
    return;
  }

  // Reject/hangup/busy can arrive over WS before initiateCall HTTP returns (id still pending_*).
  if (
    (type === "reject" || type === "hangup" || type === "busy") &&
    payload.call_uuid &&
    state.active?.direction === "outgoing" &&
    state.active.id.startsWith("pending_")
  ) {
    outgoingEndedDuringPending = true;
    patchActive({ id: payload.call_uuid });
    if (type === "busy") finish("busy");
    else if (type === "reject") finish("rejected");
    else finish("ended");
    return;
  }

  if (!state.active || state.active.id !== payload.call_uuid) return;

  if (type === "answer") {
    if (!pc) return;
    // Duplicate delivery (calls.* + user.*) — only a pending local offer accepts an answer.
    if (pc.signalingState !== "have-local-offer") return;
    // Synchronous lock: the second copy of the same answer must not slip past the
    // signalingState check while the first setRemoteDescription is still awaiting
    // (that race caused "Called in wrong state: stable" and dropped the call).
    if (applyingAnswer) return;
    applyingAnswer = true;
    // Answer arrives both for the initial offer and for ICE-restart offers.
    const isRestart = renegotiating || state.active.status === "reconnecting";
    if (!isRestart) {
      stopCallSounds();
      playConnecting();
      patchActive({ status: "connecting" });
    }
    try {
      await setRemote(payload.sdp as RTCSessionDescriptionInit);
      remoteDescSet = true;
      await drainCandidates();
      renegotiating = false;
    } catch (err) {
      renegotiating = false;
      if (isRestart) scheduleIceRestart();
      else {
        reportCallError("answer", err);
        finish("ended");
      }
    } finally {
      applyingAnswer = false;
    }
  } else if (type === "restart") {
    // Peer initiated an ICE restart — apply as a remote offer and answer back.
    if (!pc) return;
    const newSdp = (payload.sdp as RTCSessionDescriptionInit)?.sdp;
    // Duplicate delivery — same restart offer already applied.
    if (newSdp && pc.remoteDescription?.sdp === newSdp) return;
    patchActive({ status: "reconnecting" });
    try {
      if (pc.signalingState !== "stable") {
        await pc
          .setLocalDescription({ type: "rollback" } as RTCLocalSessionDescriptionInit)
          .catch(() => {});
      }
      await setRemote(payload.sdp as RTCSessionDescriptionInit);
      remoteDescSet = true;
      await drainCandidates();
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      await answerCall(state.active.id, answer);
    } catch {
      scheduleIceRestart();
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
  } else if (type === "handled") {
    // Answered/declined on ANOTHER device of the same account — stop ringing here
    // without recording a missed call (the other device owns this call now).
    if (state.active?.direction === "incoming" && state.active.status === "ringing") {
      dismissSilently();
    }
  } else if (type === "reject" || type === "hangup" || type === "busy") {
    if (type === "busy") finish("busy");
    else if (type === "reject") finish("rejected");
    else finish(state.active?.status === "connected" ? "answered" : "ended");
  }
}

/** Close the incoming-call UI on a non-answering device, leaving no history record. */
function dismissSilently(): void {
  clearTimers();
  stopCallSounds();
  teardownMedia();
  setState({ active: null, localStream: null, remoteStream: null });
}

export function ingestCallSignal(payload: { type: string; [k: string]: unknown }): void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  void handleSignal(payload as { type: string; [k: string]: any });
}

export const calls = {
  /** Subscribe to the personal call-signaling channel. Safe to call after Echo reset. */
  async init(userUuid: string): Promise<void> {
    if (!userUuid || userUuid === GUEST_USER.id) return;
    if (!getToken()) return;
    initLogger();

    const gen = ++initGen;
    if (signalUnsub) {
      signalUnsub();
      signalUnsub = null;
    }
    myUuid = userUuid;
    bindCallAudioUnlock();

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
    outgoingEndedDuringPending = false;
    clearTimers();
    unlockCallAudio();
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
      attachLocalMedia(stream, media);
      const offer = await pc.createOffer({
        offerToReceiveAudio: true,
        offerToReceiveVideo: media === "video",
      });
      await pc.setLocalDescription(offer);
      const callUuid = await initiateCall({ to: peerUuid, media, sdp: offer });
      // Callee may have declined while HTTP was in flight — reject already handled via WS.
      if (outgoingEndedDuringPending || !state.active || state.active.status === "ended") {
        outgoingEndedDuringPending = false;
        return;
      }
      patchActive({ id: callUuid });
      if (!state.active) return;
      flushPendingLocalIce(callUuid);
      startRingback();
      ringTimer = setTimeout(() => finish("missed"), RING_TIMEOUT_MS);
    } catch (err) {
      reportCallError("start", err);
      finish("ended");
    }
  },

  async accept(): Promise<void> {
    const active = state.active;
    if (!active || active.direction !== "incoming" || !incomingOffer) return;
    clearTimers();
    stopCallSounds();
    playConnecting();
    patchActive({ status: "connecting" });
    const offer = incomingOffer;
    try {
      clog("accept: getMedia", active.media);
      const stream = await getMedia(active.media);
      clog("accept: media", stream ? stream.getTracks().map((t) => t.kind) : "receive-only");
      pc = await buildPc();
      attachLocalMedia(stream, active.media);
      clog("accept: setRemoteDescription(offer)");
      await setRemote(offer);
      remoteDescSet = true;
      await drainCandidates();
      clog("accept: createAnswer");
      const answer = await pc.createAnswer();
      await pc.setLocalDescription(answer);
      clog("accept: POST answer", active.id);
      await answerCall(active.id, answer);
      clog("accept: answer sent OK");
    } catch (err) {
      reportCallError("accept", err);
      finish("ended");
    }
  },

  async decline(): Promise<void> {
    const active = state.active;
    if (!active) return;
    clearTimers();
    stopCallSounds();
    try {
      await rejectCall(active.id, "declined");
    } catch {
      toast.error("Не удалось отклонить звонок");
      // Restore ringing UI if the server never received the reject.
      if (state.active?.id === active.id && state.active.status !== "ended") {
        patchActive({ status: "ringing" });
        startRingtone();
        ringTimer = setTimeout(() => finish("missed"), RING_TIMEOUT_MS);
      }
      return;
    }
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
    void toggleCameraAsync();
  },

  /** Flip between front and back camera on mobile (replaceTrack — no renegotiation). */
  async switchCamera(): Promise<void> {
    if (!pc || !state.localStream || state.active?.media !== "video") return;
    if (switchingCamera) return;
    switchingCamera = true;
    const next: "user" | "environment" = currentFacing === "user" ? "environment" : "user";
    const sender = pc.getSenders().find((s) => s.track?.kind === "video");
    const old = state.localStream.getVideoTracks()[0];
    try {
      // Release the current camera FIRST — most phones cannot open the second
      // camera while the first is still live ("камера занята другим приложением").
      if (old) {
        state.localStream.removeTrack(old);
        old.stop();
      }
      const track = await acquireCamera(next);
      track.enabled = !state.cameraOff;
      if (sender) await sender.replaceTrack(track);
      state.localStream.addTrack(track);
      const real = track.getSettings().facingMode;
      currentFacing = real === "environment" ? "environment" : real === "user" ? "user" : next;
      setState({ localStream: state.localStream });
      logEvent("info", "calls", "camera switched", { facing: currentFacing });
    } catch (err) {
      // Restore the previous camera so the call keeps its video feed.
      try {
        const restore = await acquireCamera(currentFacing);
        restore.enabled = !state.cameraOff;
        if (sender) await sender.replaceTrack(restore);
        state.localStream.addTrack(restore);
        setState({ localStream: state.localStream });
      } catch {
        /* nothing more we can do */
      }
      reportCallError("switchCamera", err);
    } finally {
      switchingCamera = false;
    }
  },

  /**
   * Toggle whether you hear the other side. speakerOn=true → unmuted (and, on
   * phones that expose it, routed to the loud-speaker); false → remote audio
   * muted. Muting works on every platform, unlike setSinkId routing.
   */
  async toggleSpeaker(): Promise<boolean> {
    const next = !state.speakerOn;
    setState({ speakerOn: next });
    applyRemoteAudio(next);
    logEvent("info", "calls", "remote audio toggled", { on: next });
    return next;
  },
};

let switchingCamera = false;

async function toggleCameraAsync(): Promise<void> {
  if (state.active?.media !== "video" || !pc) return;
  let stream = state.localStream;
  const videoTracks = stream?.getVideoTracks() ?? [];

  if (videoTracks.length === 0 && state.cameraOff) {
    try {
      const track = await acquireCamera(currentFacing);
      track.enabled = true;
      if (!stream) {
        stream = new MediaStream();
        setState({ localStream: stream });
      }
      stream.addTrack(track);
      const sender = pc.getSenders().find((s) => s.track?.kind === "video");
      if (sender) await sender.replaceTrack(track);
      else pc.addTrack(track, stream);
      void detectMultipleCameras();
      setState({ localStream: stream, cameraOff: false });
      await performRenegotiation();
    } catch (err) {
      reportCallError("toggleCamera", err);
      toast.info("Камера недоступна");
    }
    return;
  }

  if (!stream || videoTracks.length === 0) return;
  const next = !state.cameraOff;
  videoTracks.forEach((t) => (t.enabled = !next));
  setState({ cameraOff: next });
}

/** Acquire a camera with a preferred facing, falling back from exact to ideal. */
async function acquireCamera(facing: "user" | "environment"): Promise<MediaStreamTrack> {
  let stream: MediaStream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { exact: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  } catch {
    stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: { ideal: facing }, width: { ideal: 1280 }, height: { ideal: 720 } },
      audio: false,
    });
  }
  const track = stream.getVideoTracks()[0];
  if (!track) throw new Error("no video track");
  return track;
}

async function detectMultipleCameras(): Promise<void> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const cams = devices.filter((d) => d.kind === "videoinput");
    setState({ canSwitchCamera: cams.length > 1 });
  } catch {
    /* ignore */
  }
}

/** Mute/unmute the remote participant's audio (universal across browsers). */
function applyRemoteAudio(on: boolean): void {
  if (typeof document === "undefined") return;
  const els = Array.from(document.querySelectorAll<HTMLMediaElement>("[data-call-media]"));
  for (const el of els) {
    el.muted = !on;
    if (on) el.volume = 1;
  }
  // Best-effort: prefer the loud-speaker when unmuting on phones that expose it.
  if (on && speakerRoutingSupported()) void routeToLoudspeaker();
}

async function routeToLoudspeaker(): Promise<void> {
  const els = Array.from(document.querySelectorAll<HTMLMediaElement>("[data-call-media]"));
  if (els.length === 0) return;
  let speaker: MediaDeviceInfo | undefined;
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    speaker = devices.find((d) => d.kind === "audiooutput" && /speaker|loud/i.test(d.label));
  } catch {
    return;
  }
  if (!speaker) return;
  for (const el of els) {
    const anyEl = el as HTMLMediaElement & { setSinkId?: (id: string) => Promise<void> };
    if (typeof anyEl.setSinkId !== "function") continue;
    try {
      await anyEl.setSinkId(speaker.deviceId);
    } catch {
      /* device may reject the sink — ignore */
    }
  }
}

export function useCalls<T>(selector: (s: CallsState) => T): T {
  const snap = useSyncExternalStore(subscribe, getSnap, getSnap);
  return selector(snap);
}

export function formatCallDuration(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
