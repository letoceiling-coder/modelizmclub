import type { Dialog, Message } from "@/lib/mock";
import { formatRelativeTime, upsertUsers } from "@/lib/mock";
import { me } from "@/lib/mock";
import { hydrateStore } from "@/lib/store";
import { api } from "./client";

interface ApiParticipant {
  user?: {
    uuid: string;
    display_name?: string | null;
    avatar?: { url?: string | null } | null;
  };
}

interface ApiConversation {
  uuid: string;
  type: string;
  title?: string | null;
  last_message_at?: string | null;
  participants?: ApiParticipant[];
  last_message?: { body?: string | null } | null;
}

interface ApiMessage {
  uuid: string;
  body?: string | null;
  author?: { uuid: string; display_name?: string | null; avatar?: { url?: string | null } | null };
  created_at: string;
  reply_to?: { uuid: string } | null;
}

interface Paginated<T> {
  data: T[];
}

function otherUserId(c: ApiConversation): string {
  const parts = c.participants ?? [];
  const other = parts.find((p) => p.user?.uuid && p.user.uuid !== me.id);
  return other?.user?.uuid ?? parts[0]?.user?.uuid ?? "unknown";
}

function registerAuthor(u?: ApiMessage["author"]): void {
  if (!u?.uuid) return;
  const name = u.display_name ?? "Пользователь";
  upsertUsers([
    {
      id: u.uuid,
      name,
      city: "",
      interests: "",
      avatar: u.avatar?.url ?? `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
    },
  ]);
}

export function mapConversation(c: ApiConversation): Dialog {
  for (const p of c.participants ?? []) registerAuthor(p.user as ApiMessage["author"]);

  const userId = otherUserId(c);
  const preview = c.last_message?.body ?? "";

  return {
    id: c.uuid,
    userId,
    lastMessage: preview,
    time: c.last_message_at ? formatRelativeTime(c.last_message_at) : "",
    unread: 0,
    messages: [],
  };
}

export function mapMessage(m: ApiMessage): Message {
  registerAuthor(m.author);
  return {
    id: m.uuid,
    authorId: m.author?.uuid ?? me.id,
    time: m.created_at,
    text: m.body ?? "",
    status: "read",
    replyTo: m.reply_to?.uuid,
  };
}

export async function fetchConversations(): Promise<Dialog[]> {
  const res = await api<Paginated<ApiConversation>>("/conversations?per_page=50");
  return (res.data ?? []).map(mapConversation);
}

export async function fetchMessages(conversationUuid: string): Promise<Message[]> {
  const res = await api<Paginated<ApiMessage>>(
    `/conversations/${encodeURIComponent(conversationUuid)}/messages?per_page=100`,
  );
  return (res.data ?? []).map(mapMessage);
}

export async function loadConversationsIntoStore(): Promise<void> {
  try {
    const dialogs = await fetchConversations();
    hydrateStore({ userId: me.id, dialogs });
  } catch {
    // not authenticated
  }
}
