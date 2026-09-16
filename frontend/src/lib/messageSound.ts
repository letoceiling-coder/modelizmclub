/**
 * Когда звучит пинг нового сообщения.
 *
 * Разбор 16.09: пинг звучал в каждой открытой вкладке сразу, в диалогах с
 * отметкой «без звука» и не звучал на телефоне, когда человек уже вернулся из
 * чата к списку — диалог продолжал считаться открытым. Переключателя не было.
 *
 * Правило одно: пинг — только о сообщении, которого человек сейчас не видит,
 * если звук включён и диалог не заглушён. Какая из открытых вкладок его
 * сыграет — решает claimMessagePing.
 */

const SOUND_KEY = "mc_message_sound";
const PLAYED_PREFIX = "mc_ping_";
const PLAYED_TTL_MS = 5000;

export interface PingInput {
  /** Диалог, открытый на экране (null — открытого нет). */
  watchingDialogId: string | null;
  conversationUuid: string;
  /** Отметка «без звука» у диалога. */
  muted: boolean;
  soundEnabled: boolean;
}

export function shouldPlayMessagePing(input: PingInput): boolean {
  if (!input.soundEnabled) return false;
  if (input.muted) return false;
  return input.watchingDialogId !== input.conversationUuid;
}

export function isMessageSoundEnabled(): boolean {
  try {
    return window.localStorage.getItem(SOUND_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setMessageSoundEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(SOUND_KEY, enabled ? "on" : "off");
  } catch {
    /* приватный режим: звук останется по умолчанию */
  }
}

/**
 * Первая вкладка «забирает» сообщение, остальные молчат.
 *
 * Сокет доставляет событие во все открытые вкладки в одну и ту же
 * миллисекунду. Отметка в localStorage этого не ловит: до другой вкладки
 * запись доходит асинхронно, и обе читают пустое. Замер 16.09 на проде: две
 * вкладки в ленте — два пинга. Web Locks атомарны между вкладками: замок
 * берёт одна, вторая получает отказ сразу (ifAvailable). Держим его пять
 * секунд — дольше, чем расходятся доставки одного события.
 */
export async function claimMessagePing(messageId: string): Promise<boolean> {
  const locks = typeof navigator !== "undefined" ? navigator.locks : undefined;
  if (!locks?.request) return claimByStorage(messageId);
  try {
    return await new Promise<boolean>((resolve) => {
      void locks.request(PLAYED_PREFIX + messageId, { ifAvailable: true }, (lock) => {
        resolve(lock !== null);
        if (!lock) return undefined;
        return new Promise<void>((release) => window.setTimeout(release, PLAYED_TTL_MS));
      });
    });
  } catch {
    return claimByStorage(messageId);
  }
}

/** Для браузеров без Web Locks: лучше, чем ничего, но гонку не исключает. */
function claimByStorage(messageId: string): boolean {
  try {
    const key = PLAYED_PREFIX + messageId;
    const prev = Number(window.localStorage.getItem(key) ?? 0);
    const now = Date.now();
    if (prev && now - prev < PLAYED_TTL_MS) return false;
    window.localStorage.setItem(key, String(now));
    window.setTimeout(() => {
      try {
        window.localStorage.removeItem(key);
      } catch {
        /* ignore */
      }
    }, PLAYED_TTL_MS);
    return true;
  } catch {
    return true;
  }
}
