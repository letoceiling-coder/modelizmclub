import type { Dialog, DialogAdRef, Message, User } from "@/lib/mock";
import { registerUser, makeMockWaveform } from "@/lib/mock";
import { api } from "./client";
import { mapApiUser, type ApiUser } from "./auth";
import { isDemoMode } from "@/lib/demo-mode";
import { demoConversations, demoMessages } from "@/lib/demo-data";

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

export interface ApiListingCompact {
  uuid: string;
  title: string;
  price_cents?: number;
  image?: string | null;
  preview?: string | null;
}

export interface ApiMessage {
  uuid: string;
  body?: string | null;
  type?: string;
  status?: string;
  author?: ApiCompactUser | null;
  reply_to?: { uuid: string } | null;
  forwarded_from?: { uuid: string; body?: string | null; author?: ApiCompactUser | null } | null;
  attachments?: Array<{ media?: { url?: string | null; mime_type?: string | null; duration?: number | null } | null }>;
  created_at: string;
}

interface ApiConversation {
  uuid: string;
  type?: string;
  title?: string | null;
  listing_id?: number | null;
  listing?: ApiListingCompact | null;
  is_pinned?: boolean;
  pinned_message?: ApiMessage | null;
  last_message_at?: string | null;
  participants?: Array<{ user?: ApiCompactUser | null; role?: string; pinned_at?: string | null }>;
  last_message?: ApiMessage | null;
}

interface Paginated<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

export interface ChatAttachmentUpload {
  url: string;
  type: "image" | "file";
  name: string;
  size: number;
  media_uuid: string;
}

function registerCompact(u?: ApiCompactUser | null): User | null {
  if (!u?.uuid) return null;
  const user = mapApiUser({
    id: u.id,
    uuid: u.uuid,
    name: u.display_name ?? undefined,
    profile: { display_name: u.display_name, slug: u.slug, avatar: u.avatar ?? null },
  } as ApiUser);
  registerUser(user);
  return user;
}

export function mapListingCompact(l: ApiListingCompact): DialogAdRef {
  return {
    id: l.uuid,
    title: l.title,
    price: Math.round((l.price_cents ?? 0) / 100),
    image: l.preview ?? l.image ?? undefined,
  };
}

export function mapMessage(m: ApiMessage, pinnedUuid?: string | null): Message {
  registerCompact(m.author);
  const media = (m.attachments ?? []).map((a) => a.media).filter((x): x is NonNullable<typeof x> => Boolean(x?.url));
  const audio = media.find((x) => m.type === "voice" || (x.mime_type ?? "").startsWith("audio/"));
  const fileMedia = media.find((x) => x !== audio && !(x.mime_type ?? "").startsWith("image/"));
  const imageMedia = media.find((x) => x !== audio && (x.mime_type ?? "").startsWith("image/"));

  const base: Message = {
    id: m.uuid,
    authorId: m.author?.uuid ?? "",
    time: m.created_at,
    text: m.body ?? "",
    image: imageMedia?.url ?? undefined,
    status: "read",
    replyTo: m.reply_to?.uuid,
    pinned: pinnedUuid ? m.uuid === pinnedUuid : undefined,
    forwardedFrom: m.forwarded_from?.author?.uuid,
  };

  if (audio?.url) {
    base.voice = {
      duration: Math.max(1, Math.round(audio.duration ?? 1)),
      waveform: makeMockWaveform(seedFromId(m.uuid)),
      src: audio.url,
    };
  }

  if (fileMedia?.url) {
    base.file = {
      name: fileMedia.url.split("/").pop() ?? "file",
      size: 0,
      kind: "file",
      url: fileMedia.url,
    };
  }

  return base;
}

export function mapConversation(c: ApiConversation, meUuid: string): Dialog {
  const other = (c.participants ?? [])
    .map((p) => p.user)
    .find((u) => u && u.uuid !== meUuid);
  const partner = registerCompact(other);
  const dialog: Dialog = {
    id: c.uuid,
    userId: partner?.id ?? "",
    lastMessage: c.last_message?.body ?? "",
    time: c.last_message_at ?? c.last_message?.created_at ?? "",
    unread: 0,
    messages: [],
    pinned: Boolean(c.is_pinned),
    listing: c.listing ? mapListingCompact(c.listing) : undefined,
  };
  return dialog;
}

export async function fetchConversations(meUuid: string): Promise<Dialog[]> {
  if (isDemoMode()) return demoConversations();
  const res = await api<Paginated<ApiConversation>>("/conversations", {
    query: { per_page: 50 },
  });
  return (res.data ?? []).map((c) => mapConversation(c, meUuid));
}

export async function fetchConversation(uuid: string, meUuid: string): Promise<Dialog> {
  if (isDemoMode()) {
    const found = demoConversations().find((d) => d.id === uuid);
    if (found) return found;
    throw new Error("Conversation not found");
  }
  const res = await api<{ data: ApiConversation }>(`/conversations/${uuid}`);
  return mapConversation(res.data, meUuid);
}

export async function fetchMessages(uuid: string): Promise<Message[]> {
  if (isDemoMode()) return demoMessages(uuid);
  const conv = await api<{ data: ApiConversation }>(`/conversations/${uuid}`);
  const pinnedUuid = conv.data.pinned_message?.uuid ?? null;
  const res = await api<Paginated<ApiMessage>>(`/conversations/${uuid}/messages`, {
    query: { per_page: 50 },
  });
  return (res.data ?? []).map((m) => mapMessage(m, pinnedUuid)).reverse();
}

export async function sendMessage(
  uuid: string,
  body: string,
  replyToUuid?: string,
): Promise<Message> {
  if (isDemoMode()) {
    return {
      id: `demo-m-${Date.now()}`,
      authorId: "u1",
      time: new Date().toISOString(),
      text: body,
      status: "sent",
      replyTo: replyToUuid,
    };
  }
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
  if (msg.voice && (!msg.voice.duration || msg.voice.duration < 1)) {
    msg.voice.duration = Math.max(1, Math.round(durationSec));
  }
  return msg;
}

export async function createConversation(
  userId: number,
  meUuid: string,
  listingUuid?: string,
): Promise<Dialog> {
  if (isDemoMode()) {
    const peerId = `u${userId}`;
    const existing = demoConversations().find((d) => d.userId === peerId);
    if (existing) return existing;
    return {
      id: `demo-d-${userId}-${Date.now()}`,
      userId: peerId,
      lastMessage: "",
      time: new Date().toISOString(),
      unread: 0,
      messages: [],
    };
  }
  const res = await api<{ data: ApiConversation }>("/conversations", {
    method: "POST",
    json: { user_id: userId, listing_uuid: listingUuid },
  });
  return mapConversation(res.data, meUuid);
}

export async function uploadChatAttachment(
  conversationUuid: string,
  file: File,
): Promise<ChatAttachmentUpload> {
  const form = new FormData();
  form.append("file", file);
  return api<ChatAttachmentUpload>(`/conversations/${conversationUuid}/attachments`, {
    method: "POST",
    body: form,
  });
}

export async function sendAttachmentMessage(
  conversationUuid: string,
  mediaUuid: string,
  type: "image" | "file",
  replyToUuid?: string,
): Promise<Message> {
  const res = await api<{ data: ApiMessage }>(`/conversations/${conversationUuid}/messages`, {
    method: "POST",
    json: {
      type: type === "image" ? "image" : "file",
      media_uuids: [mediaUuid],
      reply_to_uuid: replyToUuid,
    },
  });
  return mapMessage(res.data);
}

export async function hideMessageForMe(conversationUuid: string, messageUuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/conversations/${conversationUuid}/messages/${messageUuid}`, { method: "DELETE" });
}

export async function pinMessage(conversationUuid: string, messageUuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/conversations/${conversationUuid}/messages/${messageUuid}/pin`, { method: "POST" });
}

export async function unpinMessage(conversationUuid: string, messageUuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/conversations/${conversationUuid}/messages/${messageUuid}/pin`, { method: "DELETE" });
}

export async function pinConversation(conversationUuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/conversations/${conversationUuid}/pin`, { method: "POST" });
}

export async function unpinConversation(conversationUuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/conversations/${conversationUuid}/pin`, { method: "DELETE" });
}

export async function deleteConversation(conversationUuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/conversations/${conversationUuid}`, { method: "DELETE" });
}

export async function forwardMessage(
  targetConversationUuid: string,
  sourceMessageUuid: string,
  body?: string,
): Promise<Message> {
  if (isDemoMode()) {
    return {
      id: `demo-fwd-${Date.now()}`,
      authorId: "u1",
      time: new Date().toISOString(),
      text: body ?? "",
      status: "sent",
    };
  }
  const res = await api<{ data: ApiMessage }>(`/conversations/${targetConversationUuid}/messages`, {
    method: "POST",
    json: {
      body: body ?? "",
      forwarded_from_message_uuid: sourceMessageUuid,
    },
  });
  return mapMessage(res.data);
}
