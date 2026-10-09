import type { Session } from "@/lib/session";
import { isVerifiedRequiredAction } from "@/lib/feed-guest-access/routes";

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

/**
 * Ступень зрителя по запросу ['session'] — единственный вход.
 *
 * **Телефон больше не ступень общей лестницы. Решение З2 от 09.10.**
 *
 * Было так: подтверждённый телефон поднимал с `registered` на `verified`, и
 * `firstFailingStep` на пути к `subscriber` проводил человека через окно
 * подтверждения номера. Пока телефон требовался всюду, это было верно.
 *
 * После З2 телефон нужен для двух действий — публикация объявления и вывод
 * средств, — и оба спрашивают его сами, по нажатию. А лестница продолжала
 * спрашивать: замер на стенде 09.10, учётка без телефона открывает
 * `/reviews` (тир `subscription`) — и получает окно «Подтвердите номер»
 * вместо окна подписки. Телефон ей для обзоров не нужен ни по серверу, ни по
 * карте доступа: окно открывалось само и уводило в сторону. То же на
 * `/deals`. Это четвёртая жалоба владельца, воспроизведённая в браузере.
 *
 * Поэтому вошедший сразу стоит на `verified`: лестница про телефон не знает.
 * Ступень `verified` в типе остаётся — её по-прежнему открывают два действия
 * через `requestPhoneVerificationModal()`, минуя эту функцию.
 *
 * `isPhoneVerified` и `isPhoneVerificationRequired` здесь больше не нужны —
 * и это главная проверка того, что телефон из лестницы ушёл: пока они
 * вызываются, ступень от него зависит.
 */
export function levelOf(session: Session | null | undefined): Level {
  if (!session || session.user.id === "guest") return "guest";
  const user = session.user;
  // Не роль, а льгота на человека: Владелец может снять её и с сотрудника.
  if (user.subscriptionExempt === true || session.subscription.active) return "subscriber";
  return "verified";
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

/** Что делать с кнопкой действия, на которое у сервера есть свой вердикт. */
export type ServerVerdictControl = "show" | "verify" | "hide";

/**
 * Кнопка при `can[action] === false` от сервера.
 *
 * Сервер говорит «нельзя» разным людям по разным причинам, и прятать кнопку
 * можно только тогда, когда запрет по существу.
 *
 * - Гостю — потому что не знает, кто он. Кнопка видна, клик откроет вход.
 * - Вошедшему «нельзя» значит нельзя: после решения З2 телефон не мешает ни
 *   реакции, ни комментарию, и `can` их больше не занижает (см.
 *   `HasCanFlags`). Остаются настоящие запреты — закрытые комментарии,
 *   блокировка, чужая запись, — и обещать кнопку там незачем.
 *
 * Ступень `registered` сюда больше не приходит: после З2 вошедший сразу
 * стоит на `verified` (см. `levelOf`). Ветка оставлена, потому что ступень
 * существует в типе, и молча менять её смысл хуже, чем назвать вслух:
 * на этой ступени отказ тоже окончателен, окно подтверждения номера его не
 * снимет.
 */
export function controlForServerVerdict(
  viewer: Level,
  serverAllows: boolean | undefined,
): ServerVerdictControl {
  if (serverAllows !== false) return "show";
  if (viewer === "guest") return "show";
  return "hide";
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
