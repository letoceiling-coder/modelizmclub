/**
 * Когда звучит пинг нового сообщения.
 *
 * Разбор 16.09: пинг звучал в каждой открытой вкладке сразу, в диалогах с
 * отметкой «без звука» и не звучал на телефоне, когда человек уже вернулся из
 * чата к списку — диалог продолжал считаться открытым. Переключателя не было.
 *
 * Правило одно: пинг — только о сообщении, которого человек сейчас не видит,
 * если звук включён и диалог не заглушён, и только в одной вкладке.
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
  /** Эту же отметку уже проиграла другая вкладка. */
  alreadyPlayed: boolean;
}

export function shouldPlayMessagePing(input: PingInput): boolean {
  if (!input.soundEnabled) return false;
  if (input.muted) return false;
  if (input.alreadyPlayed) return false;
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
 * Первая вкладка «забирает» сообщение, остальные молчат. localStorage общий
 * для всех вкладок одного сайта; окно в пять секунд покрывает доставку сокета.
 */
export function claimMessagePing(messageId: string): boolean {
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
