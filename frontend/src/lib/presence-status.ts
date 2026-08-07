import type { User } from "@/lib/mock";
import i18n from "@/lib/i18n";

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

function pluralMinutesKey(n: number): "presence.minute_one" | "presence.minute_few" | "presence.minute_many" {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "presence.minute_one";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return "presence.minute_few";
  return "presence.minute_many";
}

function formatClock(d: Date): string {
  const locale = i18n.language === "zh" ? "zh-CN" : i18n.language === "en" ? "en-US" : "ru-RU";
  return d.toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/** Telegram-style last-seen label, localized via i18n. */
export function formatLastSeen(
  lastSeenAt: string | undefined | null,
  now: Date = new Date(),
): string {
  const tr = i18n.t.bind(i18n);
  if (!lastSeenAt) return tr("presence.longAgo");
  const t = Date.parse(lastSeenAt);
  if (Number.isNaN(t)) return tr("presence.longAgo");

  const diff = now.getTime() - t;
  if (diff < 60_000) return tr("presence.justNow");
  if (diff < 60 * 60_000) {
    const mins = Math.max(1, Math.floor(diff / 60_000));
    return tr("presence.minutesAgo", { count: mins, unit: tr(pluralMinutesKey(mins)) });
  }

  const seen = new Date(t);
  const today = startOfDay(now);
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);
  const time = formatClock(seen);
  const locale = i18n.language === "zh" ? "zh-CN" : i18n.language === "en" ? "en-US" : "ru-RU";

  if (seen >= today) return tr("presence.todayAt", { time });
  if (seen >= yesterday) return tr("presence.yesterdayAt", { time });

  const date = seen.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
  });
  if (now.getFullYear() === seen.getFullYear()) {
    return tr("presence.dateAt", { date, time });
  }

  const fullDate = seen.toLocaleDateString(locale, {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  return tr("presence.fullDateAt", { date: fullDate, time });
}

export function presenceLabel(
  userId: string,
  onlineSet: Set<string>,
  user?: Pick<User, "online" | "lastSeenAt"> | null,
): { online: boolean; text: string } {
  const online = isUserOnline(userId, onlineSet, user);
  return {
    online,
    text: online ? i18n.t("presence.online") : formatLastSeen(user?.lastSeenAt),
  };
}
