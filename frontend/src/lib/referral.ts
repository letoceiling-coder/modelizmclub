import type { User } from "./mock";
import { склонение, словоБаллы } from "./format/plural";

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

/**
 * Что принесло приглашение — подписью и признаком «начислено».
 *
 * ЗАЧЕМ ЭТО ЗДЕСЬ, А НЕ В ТРЁХ МЕСТАХ. Подпись была одна на все закрытые
 * приглашения — «Бонус начислен» — и бралась из статуса. Но `completed`
 * ставится и тогда, когда баллов не дали: исчерпан предел
 * `max_paid_invites` или тот же телефон уже приносил награду. Человек
 * читал «Бонус начислен», а баланс не рос, и объяснить разницу было
 * нечем — числа на странице не было.
 *
 * Мест, где эта подпись рисуется, три: страница приглашений, блок
 * приглашённых и админская таблица. Они уже расходились в словах
 * («Ожидает подтверждения телефона» против «Ждёт телефон»), так что
 * помощник один — иначе следующая правка снова поправит два из трёх.
 *
 * Причину «почему ноль» не называем: предел и повтор телефона в строке не
 * различаются, а придумывать за данные нельзя. Пределы объясняет текст
 * условий из админки.
 */
export function итогПриглашения(приглашение: {
  status: string;
  points?: number | null;
  listingCredits?: number | null;
}): { подпись: string; начислено: boolean } {
  if (приглашение.status !== "completed") {
    return { подпись: "Ждёт подтверждения телефона", начислено: false };
  }

  const баллы = Math.max(0, Math.trunc(Number(приглашение.points ?? 0)));
  if (баллы > 0) {
    return { подпись: `Начислено ${баллы} ${словоБаллы(баллы)}`, начислено: true };
  }

  // Приглашения до 28.09 оплачены штукой размещения, а не баллами.
  const размещения = Math.max(0, Math.trunc(Number(приглашение.listingCredits ?? 0)));
  if (размещения > 0) {
    const слово = склонение(размещения, "размещение", "размещения", "размещений");
    return { подпись: `Начислено ${размещения} ${слово}`, начислено: true };
  }

  return { подпись: "Без начисления", начислено: false };
}

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
