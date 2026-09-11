/**
 * Недавние смайлы — последние выбранные, свежий первым. Живут в
 * localStorage этого браузера. Читаются только по открытию панели, никогда
 * при серверной отрисовке.
 */

export const RECENT_EMOJI_KEY = "modelizm:emoji:recent";
export const RECENT_EMOJI_LIMIT = 24;

/** Новый список: выбранный смайл первым, без повторов, не длиннее лимита. */
export function pushRecentEmoji(list: readonly string[], emoji: string): string[] {
  return [emoji, ...list.filter((e) => e !== emoji)].slice(0, RECENT_EMOJI_LIMIT);
}

export function readRecentEmojis(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(RECENT_EMOJI_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((e): e is string => typeof e === "string" && e.length > 0)
      .slice(0, RECENT_EMOJI_LIMIT);
  } catch {
    // Хранилище закрыто (приватный режим, запрет сайта) или строка битая —
    // недавних просто нет.
    return [];
  }
}

export function saveRecentEmojis(list: readonly string[]): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(RECENT_EMOJI_KEY, JSON.stringify(list));
  } catch {
    // Хранилище переполнено или закрыто: список живёт до закрытия вкладки
    // в состоянии панели, а вставка смайла от этого не зависит.
    return;
  }
}
