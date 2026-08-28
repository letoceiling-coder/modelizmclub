import type { Dialog, DialogAdRef, DialogPostRef, Message, User } from "@/lib/mock";
import { registerUser, makeMockWaveform } from "@/lib/mock";
import { api, API_BASE_URL } from "./client";
import { mapApiUser, type ApiUser } from "./auth";
import { isDemoMode } from "@/lib/demo-mode";
import { demoConversations, demoMessages } from "@/lib/demo-data";
import { getState, openOrCreateDialogWith, restoreDialog, wasChatWithPartnerDeleted } from "@/lib/store";

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
  last_seen_at?: string | null;
}

export interface ApiListingCompact {
  uuid: string;
  title: string;
  price_cents?: number;
  image?: string | null;
  preview?: string | null;
}

export interface ApiPostCompact {
  uuid: string;
  title: string;
  excerpt?: string | null;
  image?: string | null;
  preview?: string | null;
  author_name?: string | null;
}

export interface ApiMessage {
  uuid: string;
  body?: string | null;
  type?: string;
  status?: string;
  listing?: ApiListingCompact | null;
  post?: ApiPostCompact | null;
  author?: ApiCompactUser | null;
  reply_to?: { uuid: string } | null;
  forwarded_from?: { uuid: string; body?: string | null; author?: ApiCompactUser | null } | null;
  attachments?: Array<{ media?: { uuid?: string | null; url?: string | null; mime_type?: string | null; duration?: number | null; filename?: string | null; size_bytes?: number | null; width?: number | null; height?: number | null } | null }>;
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
  unread_count?: number;
  community?: { slug?: string; name?: string; avatar?: string | null } | null;
  room?: { category_id?: number | null; root_id?: number | null } | null;
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
    last_seen_at: u.last_seen_at ?? undefined,
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

export function mapPostCompact(p: ApiPostCompact): DialogPostRef {
  return {
    id: p.uuid,
    title: p.title,
    excerpt: p.excerpt ?? undefined,
    image: p.preview ?? p.image ?? undefined,
    authorName: p.author_name ?? undefined,
  };
}

function mapMessageStatus(raw?: string | null): Message["status"] {
  if (raw === "read" || raw === "delivered" || raw === "sent") return raw;
  return "sent";
}

function resolveMediaUrl(media?: { url?: string | null; uuid?: string | null } | null): string | undefined {
  if (!media) return undefined;
  if (media.url) return media.url;
  if (media.uuid) return `${API_BASE_URL}/media/${media.uuid}`;
  return undefined;
}

export function mapMessage(m: ApiMessage, pinnedUuid?: string | null): Message {
  registerCompact(m.author);
  const media = (m.attachments ?? [])
    .map((a) => a.media)
    .filter((x): x is NonNullable<typeof x> => Boolean(x?.url || x?.uuid));
  const msgType = m.type ?? "text";

  const base: Message = {
    id: m.uuid,
    authorId: m.author?.uuid ?? "",
    time: m.created_at,
    text: m.body ?? "",
    status: mapMessageStatus(m.status),
    replyTo: m.reply_to?.uuid,
    pinned: pinnedUuid ? m.uuid === pinnedUuid : undefined,
    forwardedFrom: m.forwarded_from?.author?.uuid,
  };

  const audio = media.find((x) => msgType === "voice" || (x.mime_type ?? "").startsWith("audio/"));
  if (audio) {
    const audioUrl = resolveMediaUrl(audio);
    if (audioUrl) {
      base.voice = {
        duration: Math.max(1, Math.round(audio.duration ?? 1)),
        waveform: makeMockWaveform(seedFromId(m.uuid)),
        src: audioUrl,
        mediaUuid: audio.uuid ?? undefined,
      };
    }
  }

  const nonAudio = media.filter((x) => x !== audio);

  if (msgType === "image") {
    const imageMedia = nonAudio.find((x) => (x.mime_type ?? "").startsWith("image/")) ?? nonAudio[0];
    const imageUrl = resolveMediaUrl(imageMedia);
    if (imageUrl) {
      base.image = imageUrl;
      if (imageMedia?.width && imageMedia?.height) {
        base.imageSize = { w: imageMedia.width, h: imageMedia.height };
      }
    }
  } else if (msgType === "file") {
    const fileMedia = nonAudio[0];
    const fileUrl = resolveMediaUrl(fileMedia);
    if (fileUrl) {
      const mime = fileMedia?.mime_type ?? "";
      base.file = {
        name: fileMedia?.filename ?? fileMedia?.url?.split("/").pop() ?? "file",
        size: fileMedia?.size_bytes ?? 0,
        kind: mime.startsWith("video/") ? "video" : "file",
        url: fileUrl,
      };
    }
  } else if (nonAudio.length > 0) {
    const imageMedia = nonAudio.find((x) => (x.mime_type ?? "").startsWith("image/"));
    const fileMedia = nonAudio.find((x) => !(x.mime_type ?? "").startsWith("image/"));
    const imageUrl = resolveMediaUrl(imageMedia);
    if (imageUrl) {
      base.image = imageUrl;
      if (imageMedia?.width && imageMedia?.height) {
        base.imageSize = { w: imageMedia.width, h: imageMedia.height };
      }
    }
    const fileUrl = resolveMediaUrl(fileMedia);
    if (fileUrl) {
      const mime = fileMedia?.mime_type ?? "";
      base.file = {
        name: fileMedia?.filename ?? fileMedia?.url?.split("/").pop() ?? "file",
        size: fileMedia?.size_bytes ?? 0,
        kind: mime.startsWith("video/") ? "video" : "file",
        url: fileUrl,
      };
    }
  }

  if (m.type === "listing" && m.listing) {
    base.listing = mapListingCompact(m.listing);
  }

  if (m.type === "post" && m.post) {
    base.post = mapPostCompact(m.post);
  }

  return base;
}

export function mapConversation(c: ApiConversation, meUuid: string): Dialog {
  const other = (c.participants ?? [])
    .map((p) => p.user)
    .find((u) => u && u.uuid !== meUuid);
  const partner = registerCompact(other);
  const isCommunity = c.type === "community";
  const isRoom = c.type === "room";
  const dialog: Dialog = {
    id: c.uuid,
    userId: isCommunity || isRoom ? "" : partner?.id ?? "",
    lastMessage: c.last_message?.body ?? "",
    time: c.last_message_at ?? c.last_message?.created_at ?? "",
    unread: Math.max(0, c.unread_count ?? 0),
    messages: [],
    pinned: Boolean(c.is_pinned),
    listing: c.listing ? mapListingCompact(c.listing) : undefined,
    type: (c.type as Dialog["type"]) ?? "direct",
    title: isCommunity ? (c.community?.name ?? c.title ?? "Сообщество") : isRoom ? (c.title ?? "Чат направления") : undefined,
    avatar: isCommunity ? (c.community?.avatar ?? undefined) : undefined,
    communitySlug: c.community?.slug,
    room: isRoom && c.room?.category_id
      ? { categoryId: String(c.room.category_id), rootId: c.room.root_id ? String(c.room.root_id) : null }
      : undefined,
  };
  return dialog;
}

/** Keep one dialog per partner — API list is deduped, this is a client-side safety net. */
export function dedupeDialogsByPartner(dialogs: Dialog[]): Dialog[] {
  const seen = new Set<string>();
  const result: Dialog[] = [];
  for (const d of dialogs) {
    if (!d.userId) {
      result.push(d);
      continue;
    }
    if (seen.has(d.userId)) continue;
    seen.add(d.userId);
    result.push(d);
  }
  return result;
}

export async function markConversationRead(conversationUuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/conversations/${conversationUuid}/read`, { method: "POST" });
}

export async function fetchConversations(meUuid: string): Promise<Dialog[]> {
  if (isDemoMode()) return demoConversations();
  const [chats, communities, rooms] = await Promise.all([
    api<Paginated<ApiConversation>>("/conversations", { query: { per_page: 50 } }),
    api<Paginated<ApiConversation>>("/conversations", { query: { per_page: 50, space: "communities" } }).catch(
      () => ({ data: [] as ApiConversation[] }),
    ),
    api<Paginated<ApiConversation>>("/conversations", { query: { per_page: 50, space: "rooms" } }).catch(
      () => ({ data: [] as ApiConversation[] }),
    ),
  ]);
  const merged = [...(chats.data ?? []), ...(communities.data ?? []), ...(rooms.data ?? [])];
  return dedupeDialogsByPartner(merged.map((c) => mapConversation(c, meUuid)));
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

/** Load full message history for in-dialog search (paginated, capped). */
export async function fetchMessagesForSearch(uuid: string, maxPages = 20): Promise<Message[]> {
  if (isDemoMode()) return demoMessages(uuid);
  const conv = await api<{ data: ApiConversation }>(`/conversations/${uuid}`);
  const pinnedUuid = conv.data.pinned_message?.uuid ?? null;
  const collected: Message[] = [];
  let page = 1;
  let lastPage = 1;

  do {
    const res = await api<Paginated<ApiMessage>>(`/conversations/${uuid}/messages`, {
      query: { per_page: 100, page },
    });
    lastPage = res.meta?.last_page ?? 1;
    collected.push(...(res.data ?? []).map((m) => mapMessage(m, pinnedUuid)));
    page += 1;
  } while (page <= lastPage && page <= maxPages);

  return collected.reverse();
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
    json: replyToUuid ? { body, reply_to_uuid: replyToUuid } : { body },
  });
  return mapMessage(res.data);
}

/** Share a feed post into a chat as a rich card message (used by repost "send to messages"). */
export async function sendPostShareMessage(
  conversationUuid: string,
  postUuid: string,
): Promise<Message> {
  if (isDemoMode()) {
    return {
      id: `demo-post-${Date.now()}`,
      authorId: "u1",
      time: new Date().toISOString(),
      text: "",
      status: "sent",
    };
  }
  const res = await api<{ data: ApiMessage }>(`/conversations/${conversationUuid}/messages`, {
    method: "POST",
    json: { type: "post", post_uuid: postUuid },
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

/** Open or re-open a direct chat — clears stale local delete state and hidden history. */
export async function openConversation(
  userId: number,
  meUuid: string,
  partnerUuid: string,
  listingUuid?: string,
): Promise<Dialog> {
  const reopening = wasChatWithPartnerDeleted(partnerUuid);
  const dialog = await createConversation(userId, meUuid, listingUuid);
  if (reopening && !isDemoMode()) {
    await clearConversationHistory(dialog.id).catch(() => {});
  }
  restoreDialog(dialog);
  return dialog;
}

type MessengerNavigate = (opts: { to: "/messenger"; search: { chat: string } }) => void;

/** Open (or re-open) a direct chat and navigate with the conversation uuid in ?chat=. */
export async function navigateToPartnerChat(
  navigate: MessengerNavigate,
  partner: User,
  meUuid: string,
): Promise<void> {
  const existing = Object.values(getState().dialogs).find((d) => d.userId === partner.id);
  if (existing) {
    navigate({ to: "/messenger", search: { chat: existing.id } });
    return;
  }

  if (isDemoMode()) {
    navigate({ to: "/messenger", search: { chat: openOrCreateDialogWith(partner.id) } });
    return;
  }

  if (!partner.numericId) {
    throw new Error("Partner numeric id is missing");
  }

  const dialog = await openConversation(partner.numericId, meUuid, partner.id);
  navigate({ to: "/messenger", search: { chat: dialog.id } });
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

export async function deleteMessageForEveryone(conversationUuid: string, messageUuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/conversations/${conversationUuid}/messages/${messageUuid}/everyone`, { method: "DELETE" });
}

export async function clearConversationHistory(conversationUuid: string): Promise<void> {
  if (isDemoMode()) return;
  await api(`/conversations/${conversationUuid}/history`, { method: "DELETE" });
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

export interface VoiceTranscription {
  /** Recognized text; empty string means the request succeeded but found no speech. */
  text: string;
  /** false when STT is not configured / the request failed (503 or network). */
  available: boolean;
}

/** Speech-to-text for a voice note (stub on dev, 503 when STT is not wired). */
export async function transcribeVoiceMedia(mediaUuid: string): Promise<VoiceTranscription> {
  if (isDemoMode()) return { text: "Тестовая расшифровка голосового сообщения.", available: true };
  try {
    const res = await api<{ text?: string; message?: string }>(`/media/${mediaUuid}/transcribe`, {
      method: "POST",
    });
    return { text: (res.text ?? "").trim(), available: true };
  } catch {
    return { text: "", available: false };
  }
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
