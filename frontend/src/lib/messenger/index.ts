import { markConversationRead } from "@/lib/api/chat";
import { useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import type { Dialog, Message } from "@/lib/mock";
import { useCurrentUser } from "@/lib/session";
import { getSessionUserId } from "@/lib/session/cache";
import { getSessionQueryClient } from "@/lib/session/queryClient";
import {
  conversationsQuery,
  messagesQuery,
  setDialogsInCache,
  restoreDialogInCache,
  removeDialogFromCache,
  findDialogByPartnerInCache,
  addMessageToCache,
  replaceMessageInCache,
  removeMessageFromCache,
  setMessagesInCache,
  mergeMessagesInCache,
  markConversationReadInCache,
  markOwnMessagesStatusInCache,
  unreadMessagesTotal,
} from "@/lib/queries/messenger";
import { qk } from "@/lib/queries/keys";

// ---------------- hooks: the only way components read messenger data ----------------

export function useDialogs() {
  const me = useCurrentUser();
  const q = useQuery(conversationsQuery(me.id));
  return {
    dialogs: q.data ?? EMPTY_DIALOGS,
    isPending: q.isPending,
    error: q.error,
    refetch: q.refetch,
  };
}

export function useDialogMessages(conversationUuid: string | null) {
  const qc = useQueryClient();
  const q = useQuery({
    ...messagesQuery(qc, conversationUuid ?? "_"),
    enabled: Boolean(conversationUuid),
  });
  return {
    messages: q.data ?? EMPTY_MESSAGES,
    isPending: Boolean(conversationUuid) && q.isPending,
    error: q.error,
    refetch: q.refetch,
  };
}

export function useUnreadMessagesTotal(): number {
  const me = useCurrentUser();
  const q = useQuery({ ...conversationsQuery(me.id), select: unreadMessagesTotal });
  return q.data ?? 0;
}

const EMPTY_DIALOGS: Dialog[] = [];
const EMPTY_MESSAGES: Message[] = [];

// ---------------- imperative facade for code outside React (realtime, session, dialogs) ----------------

function qc(): QueryClient | null {
  return getSessionQueryClient();
}

const pendingHydrations = new Set<string>();

export const messengerCache = {
  setDialogs(dialogs: Dialog[], keepIds: string[] = []): void {
    const c = qc();
    if (c) setDialogsInCache(c, dialogs, keepIds);
  },
  restoreDialog(dialog: Dialog): void {
    const c = qc();
    if (c) restoreDialogInCache(c, dialog);
  },
  removeDialog(conversationUuid: string): void {
    const c = qc();
    if (c) removeDialogFromCache(c, conversationUuid);
  },
  findByPartner(partnerUuid: string): Dialog | undefined {
    const c = qc();
    return c ? findDialogByPartnerInCache(c, partnerUuid) : undefined;
  },
  dialogs(): Dialog[] {
    return qc()?.getQueryData<Dialog[]>(qk.conversations) ?? [];
  },
  addMessage(conversationUuid: string, message: Message): void {
    const c = qc();
    if (c)
      addMessageToCache(c, conversationUuid, message, {
        incrementUnread: false,
        meUuid: getSessionUserId(),
      });
  },
  /** Server-confirmed or realtime message — dedupes by id and by optimistic twin. */
  upsert(conversationUuid: string, message: Message): void {
    const c = qc();
    if (c)
      addMessageToCache(c, conversationUuid, message, {
        incrementUnread: false,
        meUuid: getSessionUserId(),
      });
  },
  replaceMessage(conversationUuid: string, tempId: string, saved: Message): void {
    const c = qc();
    if (c) replaceMessageInCache(c, conversationUuid, tempId, saved);
  },
  removeMessage(conversationUuid: string, messageId: string): void {
    const c = qc();
    if (c) removeMessageFromCache(c, conversationUuid, messageId);
  },
  setMessages(conversationUuid: string, messages: Message[]): void {
    const c = qc();
    if (c) setMessagesInCache(c, conversationUuid, messages);
  },
  mergeMessages(conversationUuid: string, incoming: Message[]): void {
    const c = qc();
    if (c) mergeMessagesInCache(c, conversationUuid, incoming);
  },
  markRead(conversationUuid: string): void {
    const c = qc();
    if (c) markConversationReadInCache(c, conversationUuid);
    // The server owns last_read_message_id; the cache update above only keeps
    // the badge honest until the next refetch.
    void markConversationRead(conversationUuid).catch(() => {});
  },
  markOwnStatus(conversationUuid: string, to: "delivered" | "read"): void {
    const c = qc();
    if (c) markOwnMessagesStatusInCache(c, conversationUuid, getSessionUserId(), to);
  },
  invalidateDialogs(): void {
    void qc()?.invalidateQueries({ queryKey: qk.conversations });
  },
  /**
   * Realtime delivery. A message for a dialog the list has not seen yet
   * hydrates that dialog once (fetchConversation) and falls back to a full
   * list refetch; unread grows only when the user is not viewing the chat.
   */
  ingestIncoming(conversationUuid: string, message: Message, incrementUnread: boolean): void {
    const c = qc();
    if (!c) return;
    const known = c
      .getQueryData<Dialog[]>(qk.conversations)
      ?.some((d) => d.id === conversationUuid);
    if (known) {
      addMessageToCache(c, conversationUuid, message, {
        incrementUnread,
        meUuid: getSessionUserId(),
      });
      return;
    }
    if (pendingHydrations.has(conversationUuid)) {
      addMessageToCache(c, conversationUuid, message, {
        incrementUnread,
        meUuid: getSessionUserId(),
      });
      return;
    }
    pendingHydrations.add(conversationUuid);
    const meId = getSessionUserId();
    void import("@/lib/api/chat")
      .then(({ fetchConversation }) => fetchConversation(conversationUuid, meId))
      .then((dialog) => {
        restoreDialogInCache(c, dialog);
        addMessageToCache(c, conversationUuid, message, { incrementUnread, meUuid: meId });
      })
      .catch(() => c.invalidateQueries({ queryKey: qk.conversations }))
      .finally(() => pendingHydrations.delete(conversationUuid));
  },
};
