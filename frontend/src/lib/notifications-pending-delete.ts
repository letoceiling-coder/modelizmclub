const STORAGE_KEY = "mc:pending-notification-deletes";

export interface PendingNotificationDelete {
  id: string;
  expiresAt: number;
}

function readAll(): PendingNotificationDelete[] {
  if (typeof sessionStorage === "undefined") return [];
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingNotificationDelete[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeAll(items: PendingNotificationDelete[]): void {
  if (typeof sessionStorage === "undefined") return;
  if (items.length === 0) {
    sessionStorage.removeItem(STORAGE_KEY);
    return;
  }
  sessionStorage.setItem(STORAGE_KEY, JSON.stringify(items));
}

export function trackPendingDelete(id: string, expiresAt: number): void {
  const items = readAll().filter((x) => x.id !== id);
  items.push({ id, expiresAt });
  writeAll(items);
}

export function clearPendingDelete(id: string): void {
  writeAll(readAll().filter((x) => x.id !== id));
}

export function clearAllPendingDeletes(): void {
  writeAll([]);
}

/** Flush queued deletes — used after refresh/navigation when undo is no longer available. */
export async function flushPendingDeletes(deleteFn: (id: string) => Promise<void>): Promise<void> {
  const pending = readAll();
  if (pending.length === 0) return;
  writeAll([]);
  await Promise.all(pending.map((p) => deleteFn(p.id).catch(() => {})));
}
