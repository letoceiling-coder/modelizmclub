import type { Dialog, Message, User } from "@/lib/mock";
import { registerUser, makeMockWaveform } from "@/lib/mock";
import { api } from "./client";
import { mapApiUser, type ApiUser } from "./auth";

function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) % 233280;
  return h;
}

interface ApiCompactUser {
  id?: number;
  uuid: string;
  display_name?: string | null;
  slug?: string | null;
  avatar?: { url?: string | null } | null;
}

interface ApiMessage {
  uuid: string;
  body?: string | null;
  type?: string;
  status?: string;
  author?: ApiCompactUser | null;
  reply_to?: { uuid: string } | null;
  attachments?: Array<{ media?: { url?: string | null; mime_type?: string | null; duration?: number | null } | null }>;
  created_at: string;
}

interface ApiConversation {
  uuid: string;
  type?: string;
  title?: string | null;
  last_message_at?: string | null;
  participants?: Array<{ user?: ApiCompactUser | null; role?: string }>;
  last_message?: ApiMessage | null;
}

interface Paginated<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

function registerCompact(u?: ApiCompactUser | null): User | null {
  if (!u?.uuid) return null;
  const user = mapApiUser({
    uuid: u.uuid,
    name: u.display_name ?? undefined,
    profile: { display_name: u.display_name, slug: u.slug, avatar: u.avatar ?? null },
  } as ApiUser);
  registerUser(user);
  return user;
}

export function mapMessage(m: ApiMessage): Message {
  registerCompact(m.author);
  const media = (m.attachments ?? []).map((a) => a.media).filter((x): x is NonNullable<typeof x> => Boolean(x?.url));
  const audio = media.find((x) => m.type === "voice" || (x.mime_type ?? "").startsWith("audio/"));
  const image = media.find((x) => x !== audio)?.url ?? undefined;

  const base: Message = {
    id: m.uuid,
    authorId: m.author?.uuid ?? "",
    time: m.created_at,
    text: m.body ?? "",
    image,
    status: "read",
    replyTo: m.reply_to?.uuid,
  };

  if (audio?.url) {
    base.voice = {
      duration: Math.max(1, Math.round(audio.duration ?? 1)),
      waveform: makeMockWaveform(seedFromId(m.uuid)),
      src: audio.url,
    };
  }

  return base;
}

export function mapConversation(c: ApiConversation, meUuid: string): Dialog {
  const other = (c.participants ?? [])
    .map((p) => p.user)
    .find((u) => u && u.uuid !== meUuid);
  const partner = registerCompact(other);
  return {
    id: c.uuid,
    userId: partner?.id ?? "",
    lastMessage: c.last_message?.body ?? "",
    time: c.last_message_at ?? c.last_message?.created_at ?? "",
    unread: 0,
    messages: [],
  };
}

export async function fetchConversations(meUuid: string): Promise<Dialog[]> {
  const res = await api<Paginated<ApiConversation>>("/conversations", {
    query: { per_page: 50 },
  });
  return (res.data ?? []).map((c) => mapConversation(c, meUuid));
}

export async function fetchMessages(uuid: string): Promise<Message[]> {
  const res = await api<Paginated<ApiMessage>>(`/conversations/${uuid}/messages`, {
    query: { per_page: 50 },
  });
  // API returns newest-first; the UI renders oldest-first.
  return (res.data ?? []).map(mapMessage).reverse();
}

export async function sendMessage(
  uuid: string,
  body: string,
  replyToUuid?: string,
): Promise<Message> {
  const res = await api<{ data: ApiMessage }>(`/conversations/${uuid}/messages`, {
    method: "POST",
    json: { body, reply_to_uuid: replyToUuid },
  });
  return mapMessage(res.data);
}

export async function uploadVoice(
  blob: Blob,
  durationSec: number,
): Promise<{ uuid: string; url: string; duration: number }> {
  const ext = blob.type.includes("mp4") ? "m4a" : blob.type.includes("ogg") ? "ogg" : "webm";
  const form = new FormData();
  form.append("file", blob, `voice-${Date.now()}.${ext}`);
  form.append("purpose", "voice");
  form.append("duration", String(Math.max(1, Math.round(durationSec))));
  const res = await api<{ data: { uuid: string; url: string; duration: number } }>("/media", {
    method: "POST",
    body: form,
  });
  return res.data;
}

export async function sendVoiceMessage(
  conversationUuid: string,
  mediaUuid: string,
  durationSec: number,
  replyToUuid?: string,
): Promise<Message> {
  const res = await api<{ data: ApiMessage }>(`/conversations/${conversationUuid}/messages`, {
    method: "POST",
    json: { type: "voice", media_uuids: [mediaUuid], reply_to_uuid: replyToUuid },
  });
  const msg = mapMessage(res.data);
  // The API echoes the stored attachment URL/duration; ensure duration falls back to the recorded value.
  if (msg.voice && (!msg.voice.duration || msg.voice.duration < 1)) {
    msg.voice.duration = Math.max(1, Math.round(durationSec));
  }
  return msg;
}

export async function createConversation(userId: number, meUuid: string): Promise<Dialog> {
  const res = await api<{ data: ApiConversation }>("/conversations", {
    method: "POST",
    json: { user_id: userId },
  });
  return mapConversation(res.data, meUuid);
}
