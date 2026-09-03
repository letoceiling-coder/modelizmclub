import type { Comment } from "@/lib/mock";

/** Insert a reply into the root thread even when `parentId` is a nested reply. */
export function appendToCommentThread(list: Comment[], parentId: string, comment: Comment): Comment[] {
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
