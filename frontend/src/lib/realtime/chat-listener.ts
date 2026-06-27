// Subscribe to conversation channels and push incoming messages into the store.

import type { Message } from "@/lib/mock";
import { me } from "@/lib/mock";
import { actions } from "@/lib/store";
import { mapMessage } from "@/lib/api/chat";
import { getEcho } from "./echo";

const subscribed = new Set<string>();

export function subscribeConversation(conversationUuid: string): void {
  const echo = getEcho();
  if (!echo || subscribed.has(conversationUuid)) return;

  subscribed.add(conversationUuid);
  echo
    .private(`conversation.${conversationUuid}`)
    .listen(".message.sent", (payload: { message?: Parameters<typeof mapMessage>[0] }) => {
      if (!payload?.message) return;
      const msg: Message = mapMessage(payload.message);
      if (msg.authorId === me.id) return;
      actions.addMessage(conversationUuid, msg);
    });
}

export function subscribeConversations(uuids: string[]): void {
  for (const id of uuids) subscribeConversation(id);
}

export function resetChatSubscriptions(): void {
  subscribed.clear();
}
