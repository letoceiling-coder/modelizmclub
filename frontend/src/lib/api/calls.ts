import { api } from "./client";

export interface IceServer {
  urls: string | string[];
  username?: string;
  credential?: string;
}

let iceCache: { servers: IceServer[]; at: number } | null = null;

export async function fetchIceServers(): Promise<IceServer[]> {
  // TURN credentials are time-limited; refresh every ~30 min.
  if (iceCache && Date.now() - iceCache.at < 30 * 60_000) return iceCache.servers;
  try {
    const res = await api<{ data: { ice_servers: IceServer[] } }>("/calls/ice-servers");
    const servers = res.data?.ice_servers ?? [];
    iceCache = { servers, at: Date.now() };
    return servers;
  } catch {
    return [{ urls: "stun:stun.l.google.com:19302" }];
  }
}

export async function initiateCall(input: {
  to: string;
  media: "audio" | "video";
  sdp: RTCSessionDescriptionInit;
}): Promise<string> {
  const res = await api<{ data: { call_uuid: string } }>("/calls", {
    method: "POST",
    json: { to: input.to, media: input.media, sdp: input.sdp },
  });
  return res.data.call_uuid;
}

export async function answerCall(uuid: string, sdp: RTCSessionDescriptionInit): Promise<void> {
  await api(`/calls/${uuid}/answer`, { method: "POST", json: { sdp } });
}

export async function restartCall(uuid: string, sdp: RTCSessionDescriptionInit): Promise<void> {
  await api(`/calls/${uuid}/restart`, { method: "POST", json: { sdp } });
}

export async function sendIce(uuid: string, candidate: RTCIceCandidateInit): Promise<void> {
  await api(`/calls/${uuid}/ice`, { method: "POST", json: { candidate } });
}

export async function rejectCall(uuid: string, reason: "declined" | "busy" = "declined"): Promise<void> {
  await api(`/calls/${uuid}/reject`, { method: "POST", json: { reason } });
}

export async function hangupCall(uuid: string): Promise<void> {
  await api(`/calls/${uuid}/hangup`, { method: "POST", json: {} });
}

export interface ApiCallRecord {
  uuid: string;
  direction: "incoming" | "outgoing";
  media: "audio" | "video";
  status: string;
  duration: number;
  started_at: string;
  peer: { uuid: string; name: string; avatar?: string | null };
}

export async function fetchIncomingCall(): Promise<{
  type: string;
  call_uuid: string;
  media: string;
  sdp: RTCSessionDescriptionInit;
  from: { uuid: string; name: string; avatar?: string | null };
} | null> {
  const res = await api<{
    data: {
      type?: string;
      call_uuid?: string;
      media?: string;
      sdp?: RTCSessionDescriptionInit;
      from?: { uuid: string; name: string; avatar?: string | null };
    } | null;
  }>("/calls/incoming");
  const d = res.data;
  if (!d?.call_uuid || !d.sdp) return null;
  return {
    type: d.type ?? "offer",
    call_uuid: d.call_uuid,
    media: d.media ?? "audio",
    sdp: d.sdp,
    from: d.from ?? { uuid: "", name: "Пользователь" },
  };
}

export async function fetchCallHistory(): Promise<ApiCallRecord[]> {
  const res = await api<{ data: ApiCallRecord[] }>("/calls");
  return res.data ?? [];
}
