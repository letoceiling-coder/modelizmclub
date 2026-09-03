import { queryOptions, type QueryClient } from "@tanstack/react-query";
import type { Dialog, Message } from "@/lib/mock";
import { fetchConversations, fetchMessages } from "@/lib/api/chat";
import { isEchoConnected } from "@/lib/realtime/echo";
import { qk, STALE, GC } from "./keys";

/**
 * The dialog list: one request, fresh for 30 s, re-polled while the page is
 * open so unread counts and presence catch up when the socket is quiet.
 * The poll is the old messenger interval; the socket path is the fast one.
 */
export function conversationsQuery(meUuid: string) {
  return queryOptions({
    queryKey: qk.conversations,
    queryFn: () => fetchConversations(meUuid),
    staleTime: STALE.conversations,
    gcTime: GC.medium,
    enabled: Boolean(meUuid) && meUuid !== "guest",
    refetchInterval: () => (isEchoConnected() ? 45_000 : 20_000),
    refetchIntervalInBackground: false,
  });
}

/**
 * Messages of one conversation. Always refetched on open; the refetch is
 * merged over the cache instead of replacing it, so an optimistic message
 * that is still in flight survives a poll landing in the middle of a send.
 */
export function messagesQuery(qc: QueryClient, conversationUuid: string) {
  return queryOptions({
    queryKey: qk.messages(conversationUuid),
    queryFn: async () => {
      const incoming = await fetchMessages(conversationUuid);
      const current = qc.getQueryData<Message[]>(qk.messages(conversationUuid));
      return current ? mergeMessages(current, incoming) : incoming;
    },
    staleTime: STALE.messages,
    gcTime: GC.medium,
    refetchInterval: () => (isEchoConnected() ? 20_000 : 10_000),
    refetchIntervalInBackground: false,
  });
}

// ---------- pure helpers (ported from the store reducer, no state of their own) ----------

function preview(m: Message): string {
  return m.text || (m.voice ? "🎤 Голосовое сообщение" : "") || (m.image ? "📷 Изображение" : "") || (m.file ? m.file.name : "");
}

function preserveMessageMedia(prev: Message, next: Message): Message {
  const merged: Message = { ...next };
  if (!merged.image && prev.image) merged.image = prev.image;
  if (!merged.file?.url && prev.file?.url) merged.file = prev.file;
  if (!merged.voice?.src && prev.voice?.src) merged.voice = prev.voice;
  if (!merged.imageSize && prev.imageSize) merged.imageSize = prev.imageSize;
  return merged;
}

function isOptimisticTwin(local: Message, incoming: Message): boolean {
  if (!String(local.id).startsWith("tmp")) return false;
  if (local.authorId !== incoming.authorId) return false;
  if ((local.text ?? "") !== (incoming.text ?? "")) return false;
  if (Boolean(local.voice) !== Boolean(incoming.voice)) return false;
  if (Boolean(local.image) !== Boolean(incoming.image)) return false;
  if (Boolean(local.file) !== Boolean(incoming.file)) return false;
  return true;
}

/** Fetched list wins; optimistic (tmp) messages not yet confirmed are kept at the end. */
export function mergeMessages(current: Message[], incoming: Message[]): Message[] {
  const incomingIds = new Set(incoming.map((m) => m.id));
  const byId = new Map(current.map((m) => [m.id, m]));
  const merged = incoming.map((m) => {
    const prev = byId.get(m.id);
    return prev ? preserveMessageMedia(prev, m) : m;
  });
  for (const m of current) {
    if (String(m.id).startsWith("tmp") && !incomingIds.has(m.id) && !incoming.some((x) => isOptimisticTwin(m, x))) {
      merged.push(m);
    }
  }
  return merged;
}

function dedupeByPartner(dialogs: Dialog[]): Dialog[] {
  const seen = new Set<string>();
  const out: Dialog[] = [];
  for (const d of dialogs) {
    if (!d.userId) {
      out.push(d);
      continue;
    }
    if (seen.has(d.userId)) continue;
    seen.add(d.userId);
    out.push(d);
  }
  return out;
}

// ---------- cache updaters: realtime, mutations and dialogs write here, never to a store ----------

/** Replace the list, keeping a currently open dialog a poll page happened to omit. */
export function setDialogsInCache(qc: QueryClient, dialogs: Dialog[], keepIds: string[] = []): void {
  qc.setQueryData<Dialog[]>(qk.conversations, (prev) => {
    const next = dedupeByPartner(dialogs);
    const have = new Set(next.map((d) => d.id));
    for (const d of prev ?? []) {
      if (!have.has(d.id) && (keepIds.includes(d.id) || d.listing || d.lastMessage)) next.push(d);
    }
    return next;
  });
}

export function restoreDialogInCache(qc: QueryClient, dialog: Dialog): void {
  qc.setQueryData<Dialog[]>(qk.conversations, (prev) => {
    const list = prev ?? [];
    const i = list.findIndex((d) => d.id === dialog.id);
    if (i >= 0) return [...list.slice(0, i), { ...list[i], ...dialog, messages: [] }, ...list.slice(i + 1)];
    return [{ ...dialog, messages: [] }, ...list];
  });
}

export function removeDialogFromCache(qc: QueryClient, conversationUuid: string): void {
  qc.setQueryData<Dialog[]>(qk.conversations, (prev) => prev?.filter((d) => d.id !== conversationUuid));
  qc.removeQueries({ queryKey: qk.messages(conversationUuid) });
}

export function findDialogByPartnerInCache(qc: QueryClient, partnerUuid: string): Dialog | undefined {
  return qc.getQueryData<Dialog[]>(qk.conversations)?.find((d) => d.userId === partnerUuid);
}

/**
 * Append a message and move its dialog to the top with the new preview.
 * Every other dialog keeps its identity, so memoised rows do not re-render.
 */
export function addMessageToCache(
  qc: QueryClient,
  conversationUuid: string,
  message: Message,
  opts: { incrementUnread: boolean; meUuid: string },
): void {
  let added = false;
  qc.setQueryData<Message[]>(qk.messages(conversationUuid), (prev) => {
    const list = prev ?? [];
    if (list.some((m) => m.id === message.id)) return list;
    const twin = list.find((m) => isOptimisticTwin(m, message));
    if (twin) {
      return list.map((m) => (m.id === twin.id ? { ...preserveMessageMedia(m, message), clientKey: m.clientKey ?? twin.id } : m));
    }
    added = true;
    return [...list, message];
  });
  if (!added && !message.id.startsWith("tmp")) return;
  const shouldUnread = opts.incrementUnread && message.authorId !== opts.meUuid;
  qc.setQueryData<Dialog[]>(qk.conversations, (prev) => {
    if (!prev) return prev;
    const i = prev.findIndex((d) => d.id === conversationUuid);
    if (i < 0) return prev;
    const cur = prev[i];
    const updated: Dialog = { ...cur, lastMessage: preview(message), time: message.time, unread: shouldUnread ? (cur.unread ?? 0) + 1 : cur.unread };
    return [updated, ...prev.filter((_, idx) => idx !== i)];
  });
}

/** Swap the optimistic (tmp) message for the server one; media the server has not echoed back yet is kept. */
export function replaceMessageInCache(qc: QueryClient, conversationUuid: string, tempId: string, saved: Message): void {
  qc.setQueryData<Message[]>(qk.messages(conversationUuid), (prev) => {
    const list = prev ?? [];
    const temp = list.find((m) => m.id === tempId);
    const normalized = temp ? preserveMessageMedia(temp, saved) : saved;
    if (!temp) return [...list.filter((m) => m.id !== normalized.id), normalized];
    return list.map((m) => (m.id === tempId ? { ...normalized, clientKey: m.clientKey ?? tempId, imageSize: normalized.imageSize ?? m.imageSize } : m));
  });
}

export function removeMessageFromCache(qc: QueryClient, conversationUuid: string, messageId: string): void {
  let last: Message | undefined;
  qc.setQueryData<Message[]>(qk.messages(conversationUuid), (prev) => {
    const next = (prev ?? []).filter((m) => m.id !== messageId);
    last = next[next.length - 1];
    return next;
  });
  qc.setQueryData<Dialog[]>(qk.conversations, (prev) =>
    prev?.map((d) => (d.id === conversationUuid ? { ...d, lastMessage: last ? preview(last) : "", time: last?.time ?? d.time } : d)),
  );
}

export function setMessagesInCache(qc: QueryClient, conversationUuid: string, messages: Message[]): void {
  qc.setQueryData<Message[]>(qk.messages(conversationUuid), messages);
}

export function mergeMessagesInCache(qc: QueryClient, conversationUuid: string, incoming: Message[]): void {
  qc.setQueryData<Message[]>(qk.messages(conversationUuid), (prev) => (prev ? mergeMessages(prev, incoming) : incoming));
}

export function markConversationReadInCache(qc: QueryClient, conversationUuid: string): void {
  qc.setQueryData<Dialog[]>(qk.conversations, (prev) =>
    prev?.map((d) => (d.id === conversationUuid && (d.unread ?? 0) > 0 ? { ...d, unread: 0 } : d)),
  );
}

/** Own messages: sent → delivered (partner online) or → read (read receipt). */
export function markOwnMessagesStatusInCache(
  qc: QueryClient,
  conversationUuid: string,
  meUuid: string,
  to: "delivered" | "read",
): void {
  qc.setQueryData<Message[]>(qk.messages(conversationUuid), (prev) => {
    if (!prev) return prev;
    const upgrade = (s: Message["status"]) => (to === "read" ? s !== "read" : s === "sent");
    let changed = false;
    const next = prev.map((m) => {
      if (m.authorId === meUuid && upgrade(m.status)) {
        changed = true;
        return { ...m, status: to };
      }
      return m;
    });
    return changed ? next : prev;
  });
}

export function unreadMessagesTotal(dialogs: Dialog[] | undefined): number {
  return (dialogs ?? []).reduce((n, d) => n + (d.unread ?? 0), 0);
}
