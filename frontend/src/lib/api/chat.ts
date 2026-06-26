import { apiRequest } from "./client";
import { getAuthToken } from "./auth";
import type { ChatMessage, Conversation, PostAuthor } from "@/lib/types";
import { avatarUrl, formatRelativeTime } from "@/lib/utils/time";

type ApiAuthor = {
  slug?: string | null;
  display_name?: string | null;
  avatar?: { url?: string | null } | null;
};

function mapAuthor(a?: ApiAuthor): PostAuthor {
  const name = a?.display_name ?? "User";
  return {
    slug: a?.slug ?? "user",
    name,
    avatar: a?.avatar?.url ?? avatarUrl(name),
  };
}

type ApiMessage = {
  uuid: string;
  body: string;
  type: string;
  status: string;
  author?: ApiAuthor;
  reply_to?: { uuid: string; body: string; author?: ApiAuthor } | null;
  created_at: string;
};

type ApiConversation = {
  uuid: string;
  type: string;
  title?: string | null;
  last_message_at?: string | null;
  participants?: Array<{ user?: ApiAuthor }>;
  last_message?: ApiMessage | null;
};

export function mapApiMessage(m: ApiMessage): ChatMessage {
  return {
    id: m.uuid,
    author: mapAuthor(m.author),
    time: formatRelativeTime(m.created_at),
    text: m.body,
    type: m.type === "voice" ? "voice" : "text",
    status: m.status as ChatMessage["status"],
    replyTo: m.reply_to
      ? {
          id: m.reply_to.uuid,
          text: m.reply_to.body,
          authorName: m.reply_to.author?.display_name ?? "User",
        }
      : undefined,
  };
}

export function mapApiConversation(c: ApiConversation): Conversation {
  return {
    id: c.uuid,
    title: c.title ?? "Диалог",
    type: c.type,
    lastMessage: c.last_message?.body,
    lastMessageAt: c.last_message_at ?? undefined,
    participants: (c.participants ?? []).map((p) => mapAuthor(p.user)),
  };
}

export async function fetchConversations(): Promise<Conversation[]> {
  const token = getAuthToken();
  if (!token) return [];
  const res = await apiRequest<{ data: ApiConversation[] }>("/conversations", { token });
  return (res.data ?? []).map(mapApiConversation);
}

export async function fetchMessages(conversationId: string): Promise<ChatMessage[]> {
  const token = getAuthToken();
  if (!token) return [];
  const res = await apiRequest<{ data: ApiMessage[] }>(`/conversations/${conversationId}/messages`, { token });
  return (res.data ?? []).reverse().map(mapApiMessage);
}

export async function sendMessage(conversationId: string, body: string, replyToUuid?: string): Promise<ChatMessage> {
  const res = await apiRequest<{ data: ApiMessage }>(`/conversations/${conversationId}/messages`, {
    method: "POST",
    token: getAuthToken(),
    json: { body, reply_to_uuid: replyToUuid },
  });
  return mapApiMessage(res.data);
}

export async function createConversation(userId: number): Promise<Conversation> {
  const res = await apiRequest<{ data: ApiConversation }>("/conversations", {
    method: "POST",
    token: getAuthToken(),
    json: { user_id: userId },
  });
  return mapApiConversation(res.data);
}
