import type { Comment } from "@/lib/mock";

/** Insert a reply into the root thread even when `parentId` is a nested reply. */
export function appendToCommentThread(
  list: Comment[],
  parentId: string,
  comment: Comment,
): Comment[] {
  if (list.some((c) => c.id === parentId)) {
    return list.map((c) =>
      c.id === parentId ? { ...c, replies: [...(c.replies ?? []), comment] } : c,
    );
  }
  return list.map((c) => {
    if ((c.replies ?? []).some((r) => r.id === parentId)) {
      return { ...c, replies: [...(c.replies ?? []), comment] };
    }
    return c;
  });
}

export function removeFromCommentThread(list: Comment[], id: string): Comment[] {
  return list
    .filter((c) => c.id !== id)
    .map((c) => ({ ...c, replies: (c.replies ?? []).filter((r) => r.id !== id) }));
}

/** Есть ли комментарий с этим id в ветке — среди корневых или среди ответов. */
export function hasComment(list: Comment[], id: string): boolean {
  return list.some((c) => c.id === id || (c.replies ?? []).some((r) => r.id === id));
}

/** Комментарий, который человек отправил и которого сервер ещё мог не прислать. */
export interface PendingComment {
  parentId?: string;
  comment: Comment;
}

/*
 * Первая страница ветки плюс отправленное, пока она шла.
 *
 * Окно открывается, запрос первой страницы уходит, человек сразу пишет
 * комментарий — оптимистичная вставка ложится в список. Потом приходит
 * ответ, собранный до отправки, и заменяет список целиком: комментарий
 * сохранён, но с экрана пропал до переоткрытия окна. Воспроизводилось
 * задержкой GET на 2,5 с, а на живой сети — отправкой в первую секунду.
 *
 * Поэтому ответ не заменяет, а сливается: всё, чего в нём нет из
 * отправленного, добавляется обратно на своё место — в корень или к
 * родителю. То, что сервер уже знает, второй раз не вставляется.
 */
export function mergePendingComments(server: Comment[], pending: PendingComment[]): Comment[] {
  return pending.reduce((list, p) => {
    if (hasComment(list, p.comment.id)) return list;
    return p.parentId ? appendToCommentThread(list, p.parentId, p.comment) : [...list, p.comment];
  }, server);
}

/** Следующая страница без повторов: уже показанное второй раз не добавляется. */
export function appendCommentPage(prev: Comment[], page: Comment[]): Comment[] {
  return [...prev, ...page.filter((c) => !hasComment(prev, c.id))];
}

export function replaceInCommentThread(
  list: Comment[],
  parentId: string | undefined,
  tempId: string,
  saved: Comment,
): Comment[] {
  if (!parentId) return list.map((c) => (c.id === tempId ? saved : c));
  return list.map((c) => {
    if (c.id === parentId || (c.replies ?? []).some((r) => r.id === parentId || r.id === tempId)) {
      return { ...c, replies: (c.replies ?? []).map((r) => (r.id === tempId ? saved : r)) };
    }
    return c;
  });
}
