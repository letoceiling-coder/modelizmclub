import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { Dialog, Message } from "@/lib/mock";
import { fetchConversations, fetchMessages } from "@/lib/api/chat";
import { qk, STALE, GC } from "./keys";

/** The dialog list — one request, 30 s fresh, kept for 10 min. */
export function conversationsQuery(meUuid: string) {
  return queryOptions({
    queryKey: qk.conversations,
    queryFn: () => fetchConversations(meUuid),
    staleTime: STALE.conversations,
    gcTime: GC.medium,
    enabled: Boolean(meUuid) && meUuid !== "guest",
  });
}

/** Messages of one conversation — always refetched on open, cached for 10 min. */
export function messagesQuery(conversationUuid: string) {
  return queryOptions({
    queryKey: qk.messages(conversationUuid),
    queryFn: () => fetchMessages(conversationUuid),
    staleTime: STALE.messages,
    gcTime: GC.medium,
  });
}

// ---- cache updaters: the realtime hub and mutations write here, never to a store ----

/** Insert or replace a message; keeps the list sorted by time. */
export function upsertMessageInCache(qc: QueryClient, conversationUuid: string, message: Message): void {
  qc.setQueryData<Message[]>(qk.messages(conversationUuid), (prev) => {
    const list = prev ?? [];
    const i = list.findIndex((m) => m.id === message.id || (message.clientKey && m.clientKey === message.clientKey));
    const next = i >= 0 ? [...list.slice(0, i), { ...list[i], ...message }, ...list.slice(i + 1)] : [...list, message];
    return next;
  });
}

export function removeMessageFromCache(qc: QueryClient, conversationUuid: string, messageId: string): void {
  qc.setQueryData<Message[]>(qk.messages(conversationUuid), (prev) => (prev ?? []).filter((m) => m.id !== messageId));
}

/**
 * Move a dialog to the top with its new preview. Item identity is preserved
 * for every other dialog, so memoised rows do not re-render — this is the
 * "bump without redrawing the list" the product asks for.
 */
export function bumpConversationInCache(
  qc: QueryClient,
  conversationUuid: string,
  patch: Partial<Pick<Dialog, "lastMessage" | "time" | "unread">>,
  incrementUnread = false,
): void {
  qc.setQueryData<Dialog[]>(qk.conversations, (prev) => {
    if (!prev) return prev;
    const i = prev.findIndex((d) => d.id === conversationUuid);
    if (i < 0) return prev;
    const cur = prev[i];
    const updated: Dialog = {
      ...cur,
      ...patch,
      unread: incrementUnread ? (cur.unread ?? 0) + 1 : (patch.unread ?? cur.unread),
    };
    const rest = prev.filter((_, idx) => idx !== i);
    return [updated, ...rest];
  });
}

export function markConversationReadInCache(qc: QueryClient, conversationUuid: string): void {
  qc.setQueryData<Dialog[]>(qk.conversations, (prev) =>
    prev?.map((d) => (d.id === conversationUuid && (d.unread ?? 0) > 0 ? { ...d, unread: 0 } : d)),
  );
}
