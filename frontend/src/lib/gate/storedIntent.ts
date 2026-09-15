import type { Intent } from "./intent";
import { firstFailingStep, meets, type GateWindow, type Level } from "./levels";

export type StoredIntentDecision =
  | { kind: "none" }
  | { kind: "clear" }
  | { kind: "resume" }
  | { kind: "wait" }
  | { kind: "prompt"; window: GateWindow };

/**
 * Что делать с намерением, пережившим уход со страницы (вход по OAuth или
 * ссылке с токеном).
 *
 * Уровень достигнут — повторить действие. Не достигнут — показать следующий
 * недостающий шаг, но один раз: человек сам нажал кнопку до входа, это и есть
 * спрос. Раньше намерение молча лежало, и вошедший без подписки возвращался на
 * страницу сообщества без окна и без вступления (приёмка 15.09). Гостю окно не
 * поднимаем: он ещё не вошёл, вход — его выбор.
 */
export function decideStoredIntent(level: Level, stored: Intent | null): StoredIntentDecision {
  if (!stored) return { kind: "none" };
  if (!stored.level) return { kind: "clear" };
  if (meets(level, stored.level)) return { kind: "resume" };
  if (level === "guest") return { kind: "wait" };
  const window = firstFailingStep(level, stored.level);
  if (!window || stored.prompted === window) return { kind: "wait" };
  return { kind: "prompt", window };
}
