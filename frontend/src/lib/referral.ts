import type { User } from "./mock";

/**
 * Запасное число баллов, пока настройки не приехали.
 *
 * Не правило, а заглушка на один кадр: настоящее значение приходит с
 * сервера (`points_per_invite`), и правится оно в админке. Держать здесь
 * второе «настоящее» число значило бы иметь два источника одной величины —
 * и однажды они разойдутся.
 */
export const REFERRAL_POINTS_FALLBACK = 100;

/**
 * Текст приглашения — один на все способы отправки.
 *
 * Он уходит и в Telegram (`text=`), и в VK (`title=`), и в WhatsApp
 * (перед ссылкой), и в системное окно. До 28.09 на странице приглашений
 * его не было вовсе: WhatsApp получал голую ссылку. Держать строку в
 * четырёх местах — способ снова её потерять в одном из них.
 */
export const INVITE_TEXT = "Присоединяйся к МоДелизМ Клубу";

export interface InvitedFriend {
  userId: string;
  joinedAt: string;
}

// Реферальная программа ещё не реализована на бэкенде — без моковых данных
// показываем пустое состояние, пока не появится соответствующий API.
export function getInvitedFriends(): InvitedFriend[] {
  return [];
}

export function getReferralCode(userId: string): string {
  if (!userId || userId === "guest") return "";
  return `MDLZM-${userId.toUpperCase().slice(0, 6)}`;
}

// Canonical public origin. Used on the server and during initial client
// render so SSR hydration matches; swap to window.location.origin only after
// mount (see InviteBlock).
export function publicOrigin(): string {
  if (typeof window !== "undefined" && window.location?.origin) {
    return window.location.origin;
  }
  return "https://modelizmclub.ru";
}

/** Fallback origin for SSR. Prefer `publicOrigin()` at call time. */
export const PUBLIC_ORIGIN = "https://modelizmclub.ru";

export function getReferralLink(userId: string): string {
  const code = getReferralCode(userId);
  const origin = publicOrigin();
  return code ? `${origin}/r/${encodeURIComponent(code)}` : origin;
}

export function getReferralBonus(): number {
  return 0;
}

// Резолв пригласившего по коду требует API — пока возвращаем null.
export function getInviterByCode(_code?: string): User | null {
  return null;
}
