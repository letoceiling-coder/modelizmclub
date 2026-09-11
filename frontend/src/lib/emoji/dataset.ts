/*
 * Полный набор смайлов с русскими названиями и тегами (emojibase 17).
 *
 * Модуль импортируется только динамически — из `load.ts`. Статический импорт
 * отсюда в любом компоненте вернул бы ≈740 КБ JSON в начальный бандл.
 */
import compact from "emojibase-data/ru/compact.json";
import messages from "emojibase-data/ru/messages.json";
import { buildEmojiCatalog } from "./catalog";

export const emojiCatalog = buildEmojiCatalog(compact, messages.groups);
