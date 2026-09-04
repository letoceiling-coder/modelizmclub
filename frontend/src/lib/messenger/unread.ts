import type { Message } from "@/lib/mock";

/**
 * Первое сообщение, которое человек ещё не видел.
 *
 * Курсор — uuid последнего прочитанного сообщения (last_read_message_uuid с
 * бэкенда). Свои сообщения непрочитанными не бывают, поэтому хвост из
 * собственных ответов не считается новым. Если курсора нет в загруженном окне,
 * значит он старше всей пачки — непрочитано всё, что пришло не от нас.
 */
export function findFirstUnreadMessageId(
  messages: Message[],
  lastReadMessageId: string | undefined,
  meUuid: string,
): string | null {
  if (!lastReadMessageId) return null;
  const cursorIndex = messages.findIndex((m) => m.id === lastReadMessageId);
  const tail = messages.slice(cursorIndex + 1);
  return tail.find((m) => m.authorId !== meUuid)?.id ?? null;
}
