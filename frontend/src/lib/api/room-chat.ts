import type { Message } from "@/lib/mock";
import { api } from "./client";
import {
  fetchMessages,
  mapMessage,
  uploadChatAttachment,
  type ApiMessage,
} from "./chat";
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
