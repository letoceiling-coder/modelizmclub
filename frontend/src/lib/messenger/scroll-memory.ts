/**
 * Где человек остановился в каждом диалоге — на время сессии, в памяти модуля.
 * Возврат в чат не должен телепортировать вниз: если непрочитанных нет,
 * список сообщений открывается там же, где его оставили.
 *
 * Правило приоритета: непрочитанные важнее сохранённой позиции — вызывающий
 * код сначала ищет первое непрочитанное и только потом спрашивает эту карту.
 */
const positions = new Map<string, number>();

export function rememberDialogScroll(conversationUuid: string, top: number): void {
  if (!conversationUuid) return;
  positions.set(conversationUuid, Math.max(0, Math.round(top)));
}

export function recallDialogScroll(conversationUuid: string): number | undefined {
  return positions.get(conversationUuid);
}

export function forgetDialogScroll(conversationUuid: string): void {
  positions.delete(conversationUuid);
}
