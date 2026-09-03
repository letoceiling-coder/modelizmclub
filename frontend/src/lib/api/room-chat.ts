import type { Message } from "@/lib/mock";
import type { User } from "@/lib/mock";
import { api } from "./client";
import { fetchMessages, mapMessage, uploadChatAttachment, type ApiMessage } from "./chat";
import { mapCompactUser, type ApiCompactUser } from "./social";
import { isDemoMode } from "@/lib/demo-mode";

export interface RoomMessage extends Message {
  replyToId?: string;
  attachments?: string[];
}

function formatRoomTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleTimeString("ru", { hour: "2-digit", minute: "2-digit" });
}

export function mapApiMessageToRoom(m: ApiMessage): RoomMessage {
  const mapped = mapMessage(m);
  const attachments = (m.attachments ?? [])
    .map((a) => a.media?.url)
    .filter((url): url is string => Boolean(url));

  return {
    ...mapped,
    time: formatRoomTime(mapped.time),
    replyToId: mapped.replyTo,
    attachments: attachments.length ? attachments : mapped.image ? [mapped.image] : undefined,
  };
}

export function mapMessageToRoom(m: Message): RoomMessage {
  return {
    ...m,
    time: formatRoomTime(m.time),
    replyToId: m.replyTo,
    attachments: m.image ? [m.image] : undefined,
  };
}

export async function resolveRoomConversation(parentId: string, subId: string): Promise<string> {
  if (isDemoMode()) return `demo-room-${parentId}-${subId}`;
  const res = await api<{ data: { conversation_uuid: string } }>(
    `/categories/posts/${parentId}/rooms/${subId}/conversation`,
  );
  return res.data.conversation_uuid;
}

export async function fetchRoomMessages(conversationUuid: string): Promise<RoomMessage[]> {
  const msgs = await fetchMessages(conversationUuid);
  return msgs.map((m) => mapMessageToRoom(m));
}

export async function sendRoomMessage(
  conversationUuid: string,
  body: string,
  replyToUuid?: string,
  mediaUuids?: string[],
): Promise<RoomMessage> {
  const hasMedia = Boolean(mediaUuids?.length);
  const res = await api<{ data: ApiMessage }>(`/conversations/${conversationUuid}/messages`, {
    method: "POST",
    json: {
      body: body || undefined,
      reply_to_uuid: replyToUuid,
      type: hasMedia ? "image" : "text",
      media_uuids: mediaUuids,
    },
  });
  return mapApiMessageToRoom(res.data);
}

export async function uploadRoomAttachment(conversationUuid: string, file: File): Promise<string> {
  const uploaded = await uploadChatAttachment(conversationUuid, file);
  return uploaded.media_uuid;
}

export interface RoomMember {
  user: User;
  role?: string;
}

export interface CategoryRoomStats {
  bySubcategory: Record<string, { members: number; online: number }>;
  byParent: Record<string, { members: number; online: number }>;
}

export async function fetchRoomMembers(
  parentId: string,
  subId: string,
): Promise<{ members: RoomMember[]; onlineCount: number; total: number }> {
  if (isDemoMode()) return { members: [], onlineCount: 0, total: 0 };
  const res = await api<{
    data: {
      members: Array<{ user: ApiCompactUser; role?: string | null }>;
      online_count: number;
      total: number;
    };
  }>(`/categories/posts/${parentId}/rooms/${subId}/members`);
  return {
    members: (res.data.members ?? []).map((m) => ({
      user: mapCompactUser(m.user),
      role: m.role ?? undefined,
    })),
    onlineCount: res.data.online_count ?? 0,
    total: res.data.total ?? 0,
  };
}

export async function fetchCategoryRoomStats(parentId?: string): Promise<CategoryRoomStats> {
  if (isDemoMode()) {
    return { bySubcategory: {}, byParent: {} };
  }
  const path = parentId
    ? `/categories/posts/${parentId}/rooms/stats`
    : "/categories/posts/rooms/stats";
  const res = await api<{
    data: {
      by_subcategory?: Record<string, { members: number; online: number }>;
      by_parent?: Record<string, { members: number; online: number }>;
    };
  }>(path);
  const bySubcategory: CategoryRoomStats["bySubcategory"] = {};
  const byParent: CategoryRoomStats["byParent"] = {};
  for (const [id, stats] of Object.entries(res.data.by_subcategory ?? {})) {
    bySubcategory[id] = { members: stats.members ?? 0, online: stats.online ?? 0 };
  }
  for (const [id, stats] of Object.entries(res.data.by_parent ?? {})) {
    byParent[id] = { members: stats.members ?? 0, online: stats.online ?? 0 };
  }
  return { bySubcategory, byParent };
}
