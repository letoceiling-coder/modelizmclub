import type { Dialog, Message, User } from "@/lib/mock";
import { registerUser } from "@/lib/mock";
import { api } from "./client";
import { mapApiUser, type ApiUser } from "./auth";

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
  attachments?: Array<{ media?: { url?: string | null } | null }>;
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
  const image = m.attachments?.map((a) => a.media?.url).find((u): u is string => Boolean(u));
  return {
    id: m.uuid,
    authorId: m.author?.uuid ?? "",
    time: m.created_at,
    text: m.body ?? "",
    image,
    status: "read",
    replyTo: m.reply_to?.uuid,
  };
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

export async function createConversation(userId: number, meUuid: string): Promise<Dialog> {
  const res = await api<{ data: ApiConversation }>("/conversations", {
    method: "POST",
    json: { user_id: userId },
  });
  return mapConversation(res.data, meUuid);
}
