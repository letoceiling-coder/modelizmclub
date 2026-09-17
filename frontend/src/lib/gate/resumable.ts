/**
 * Действия, которые переживают полную перезагрузку.
 *
 * Гейт держит отказанное действие замыканием в памяти. Вход через окно
 * (почта и пароль) остаётся на той же странице, и замыкание повторяется. Но
 * вход через OAuth и по ссылке с токеном — это уход со страницы и возврат:
 * памяти уже нет, и гость, нажавший «В избранное», возвращался на объявление
 * без избранного (приёмка 13.09, D3).
 *
 * Поэтому у нескольких действий есть второе описание — не замыкание, а ключ
 * и параметры, которые кладутся в `gate.intent` вместе с ним. После входа
 * хост находит ключ здесь и выполняет действие сам.
 *
 * Действие здесь — «поставить», а не «переключить»: гость не мог лайкнуть
 * заранее, а повтор, дошедший до сервера дважды, не должен снять лайк.
 * Модули API подгружаются по требованию: гейт живёт в корневом чанке, и
 * тянуть в него ленту, объявления и сообщества ради редкого возврата незачем.
 */

export const RESUME_PREFIX = "resume:";

export type ResumableKey =
  "post.like" | "post.save" | "listing.favorite" | "listing.reveal_phone" | "community.join";

type Params = Record<string, unknown>;

const HANDLERS: Record<ResumableKey, (params: Params) => Promise<unknown>> = {
  "post.like": async ({ uuid }) => (await import("@/lib/api/feed")).reactToPost(String(uuid), true),
  "post.save": async ({ uuid }) =>
    (await import("@/lib/api/feed")).bookmarkPost(String(uuid), true),
  "listing.favorite": async ({ uuid }) => {
    await (await import("@/lib/api/listings")).addFavoriteListing(String(uuid));
    // Значок избранного читает локальный список; вход по токену уже
    // синхронизировал его — до того, как действие дошло до сервера.
    await (await import("@/lib/auth/session")).syncFavoritesFromServer();
  },
  // Номер кладётся туда же, откуда его читает страница объявления: после
  // входа по ссылке страница уже смонтирована заново и покажет его сама.
  "listing.reveal_phone": async ({ uuid }) => {
    const phone = await (await import("@/lib/api/listings")).revealSellerPhone(String(uuid));
    (await import("@/lib/store")).actions.setRevealedPhone(String(uuid), phone);
  },
  "community.join": async ({ slug }) =>
    (await import("@/lib/api/communities")).joinCommunity(String(slug)),
};

/** Ключ намерения для повторяемого действия. */
export function resumeIntentKey(key: ResumableKey): string {
  return `${RESUME_PREFIX}${key}`;
}

/** Обработчик по ключу намерения, или null, если действие не повторяемое. */
export function resumableHandler(
  intentKey: string | undefined,
): ((params: Params) => Promise<unknown>) | null {
  if (!intentKey?.startsWith(RESUME_PREFIX)) return null;
  const key = intentKey.slice(RESUME_PREFIX.length) as ResumableKey;
  return HANDLERS[key] ?? null;
}
