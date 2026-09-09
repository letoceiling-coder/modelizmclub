import type { Session } from "@/lib/session";
import { isVerifiedRequiredAction } from "@/lib/feed-guest-access/routes";
import { isPhoneVerificationRequired, isPhoneVerified, isStaffUser } from "@/lib/auth/verification";

/** The access ladder. Every gate asks for exactly one rung. */
export type Level = "guest" | "registered" | "verified" | "subscriber";

export const LEVEL_ORDER: readonly Level[] = ["guest", "registered", "verified", "subscriber"];

/** The one window that gets a user from `have` to the next rung. */
export type GateWindow = "auth" | "verify" | "paywall";

export function levelRank(level: Level): number {
  return LEVEL_ORDER.indexOf(level);
}

export function meets(have: Level, need: Level): boolean {
  return levelRank(have) >= levelRank(need);
}

/** Derive the viewer's rung from the ['session'] query — the only input. */
export function levelOf(session: Session | null | undefined): Level {
  if (!session || session.user.id === "guest") return "guest";
  const user = session.user;
  if (isStaffUser(user) || session.subscription.active) return "subscriber";
  if (session.phoneVerified || isPhoneVerified(user) || !isPhoneVerificationRequired(user))
    return "verified";
  return "registered";
}

/**
 * Exactly one reason for refusal: the first rung the viewer is missing.
 * guest → auth, registered → verify, verified → paywall. Never two windows.
 */
export function firstFailingStep(have: Level, need: Level): GateWindow | null {
  if (meets(have, need)) return null;
  if (have === "guest") return "auth";
  if (have === "registered") return "verify";
  return "paywall";
}

/**
 * Мост от тиров карты доступа (`guest | auth | subscription`, настраиваются
 * в админке) к ступени лестницы.
 *
 * `auth` — это «вошёл», а не «подтвердил телефон». Раньше он молча падал в
 * `default: "verified"` с объяснением «старый страж всегда требовал СМС
 * сразу после входа»: причина устарела, а поведение осталось, и ветки для
 * `auth` в коде не было вовсе.
 *
 * Из-за этого подтверждения телефона требовали все 34 действия тира — не
 * только размещение объявления, но и переключение фильтра ленты, поиск в
 * шапке, клик по имени автора и вход в настройки. Последнее — ловушка без
 * выхода: номер подтверждают в настройках, а войти в них без
 * подтверждённого номера было нельзя.
 *
 * Требование СМС живёт отдельно и всегда жило — `isVerifiedRequiredRoute`
 * в lib/feed-guest-access/routes.ts. Тир отвечает на вопрос «нужен ли вход»,
 * список — на вопрос «нужен ли телефон». Смешивать их в одном значении и
 * было ошибкой.
 *
 * `default` остаётся строгим: неизвестное значение тира — повод потребовать
 * больше, а не меньше. Все три существующих значения разобраны явно.
 */
export function levelFromAccessTier(tier: string | null | undefined): Level {
  switch (tier) {
    case "guest":
      return "guest";
    case "auth":
      return "registered";
    case "subscription":
      return "subscriber";
    default:
      return "verified";
  }
}

/**
 * Ступень, которую спрашивает конкретное действие.
 *
 * Тир из карты доступа плюс список действий, которым нужен телефон. Раньше
 * три места считали это выражением `levelFromAccessTier(resolveMinTier(...))`
 * каждое у себя, и добавить требование телефона можно было только в трёх
 * местах сразу — то есть рано или поздно в двух.
 */
export function levelForAction(actionKey: string, tier: string | null | undefined): Level {
  const base = levelFromAccessTier(tier);
  if (!isVerifiedRequiredAction(actionKey)) return base;
  return meets(base, "verified") ? base : "verified";
}
