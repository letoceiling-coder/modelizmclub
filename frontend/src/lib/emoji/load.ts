import type { EmojiCatalog } from "./catalog";

/*
 * Данные смайлов грузятся при первом открытии панели и остаются в памяти
 * модуля: повторное открытие — и любая другая панель на странице — берут
 * готовый каталог без запроса.
 *
 * Динамический `import()` выносит JSON emojibase в отдельный чанк: в
 * начальный бандл он не попадает.
 */
let loaded: EmojiCatalog | null = null;
let pending: Promise<EmojiCatalog> | null = null;

/** Каталог, если уже загружен; иначе null. Запроса не делает. */
export function peekEmojiCatalog(): EmojiCatalog | null {
  return loaded;
}

export function loadEmojiCatalog(): Promise<EmojiCatalog> {
  if (loaded) return Promise.resolve(loaded);
  pending ??= import("./dataset").then(
    (m) => {
      loaded = m.emojiCatalog;
      return loaded;
    },
    (error: unknown) => {
      // Следующее открытие попробует снова, а не получит тот же отказ.
      pending = null;
      throw error;
    },
  );
  return pending;
}
