import type { User } from "@/lib/mock";

/** Consider the user online if seen within this window (HTTP heartbeat fallback). */
export const PRESENCE_ONLINE_MS = 2 * 60 * 1000;

export function isUserOnline(
  userId: string,
  onlineSet: Set<string>,
  user?: Pick<User, "online" | "lastSeenAt"> | null,
): boolean {
  if (onlineSet.has(userId)) return true;
  if (user?.online) return true;
  const seen = user?.lastSeenAt;
  if (!seen) return false;
  const t = Date.parse(seen);
  return !Number.isNaN(t) && Date.now() - t <= PRESENCE_ONLINE_MS;
}

function pluralMinutes(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "минуту";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "минуты";
  return "минут";
}

function formatClock(d: Date): string {
  return d.toLocaleTimeString("ru-RU", { hour: "2-digit", minute: "2-digit" });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Telegram-style last-seen label in Russian. */
export function formatLastSeen(
  lastSeenAt: string | undefined | null,
  now: Date = new Date(),
): string {
  if (!lastSeenAt) return "давно не был(а) в сети";
  const t = Date.parse(lastSeenAt);
  if (Number.isNaN(t)) return "давно не был(а) в сети";

  const diff = now.getTime() - t;
  if (diff < 60_000) return "был(а) только что";
  if (diff < 60 * 60_000) {
    const mins = Math.max(1, Math.floor(diff / 60_000));
    return `был(а) ${mins} ${pluralMinutes(mins)} назад`;
  }

  const seen = new Date(t);
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = formatClock(seen);

  if (seen >= today) return `был(а) сегодня в ${time}`;
  if (seen >= yesterday) return `был(а) вчера в ${time}`;

  const date = seen.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
  });
  if (now.getFullYear() === seen.getFullYear()) {
    return `был(а) ${date} в ${time}`;
  }

  return `был(а) ${seen.toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  })}`;
}

export function presenceLabel(
  userId: string,
  onlineSet: Set<string>,
  user?: Pick<User, "online" | "lastSeenAt"> | null,
): { online: boolean; text: string } {
  const online = isUserOnline(userId, onlineSet, user);
  return {
    online,
    text: online ? "в сети" : formatLastSeen(user?.lastSeenAt),
  };
}
