import { api } from "./client";

export interface LiveKitJoin {
  url: string;
  token: string;
  room: string;
  identity: string;
}

export async function fetchLiveKitToken(room: string): Promise<LiveKitJoin> {
  const res = await api<{ data: LiveKitJoin }>("/calls/livekit/token", {
    method: "POST",
    json: { room },
  });
  return res.data;
}

export async function inviteToGroup(
  room: string,
  to: string[],
  media: "audio" | "video" = "video",
  title?: string,
): Promise<number> {
  const res = await api<{ data: { invited: number } }>("/calls/group/invite", {
    method: "POST",
    json: { room, to, media, title },
  });
  return res.data.invited;
}
