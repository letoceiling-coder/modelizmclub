import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Сколько секунд осталось до срока.
 *
 * Отдельно от хука, потому что здесь вся арифметика, и проверять её живой
 * отправкой SMS — это тратить настоящее сообщение и шаг к пределу.
 * Округление вверх: пока не наступил срок, показываем хотя бы одну секунду,
 * иначе кнопка успевает разблокироваться на полсекунды раньше сервера.
 */
export function secondsLeft(until: number, now: number): number {
  if (until <= 0) return 0;
  return Math.max(0, Math.ceil((until - now) / 1000));
}

/**
 * Обратный отсчёт до следующей отправки SMS.
 *
 * Держит срок, а не оставшиеся секунды: вкладку сворачивают, таймеры в
 * фоне замедляются, и счётчик, уменьшаемый на единицу, отстал бы от сервера.
 * Отсюда же берётся признак «кнопка заблокирована» — одно состояние на оба
 * применения, чтобы подпись и `disabled` не разошлись.
 */
export function useResendCountdown(): {
  left: number;
  blocked: boolean;
  start: (seconds: number) => void;
  clear: () => void;
} {
  const untilRef = useRef(0);
  const [left, setLeft] = useState(0);

  useEffect(() => {
    if (left <= 0) return;
    const id = window.setInterval(() => {
      setLeft(secondsLeft(untilRef.current, Date.now()));
    }, 250);
    return () => window.clearInterval(id);
  }, [left]);

  const start = useCallback((seconds: number) => {
    if (seconds <= 0) return;
    untilRef.current = Date.now() + seconds * 1000;
    setLeft(seconds);
  }, []);

  const clear = useCallback(() => {
    untilRef.current = 0;
    setLeft(0);
  }, []);

  return { left, blocked: left > 0, start, clear };
}

/** «1:05» для минут и «47 с» для секунд — читается быстрее, чем «65 сек.». */
export function formatCountdown(seconds: number): string {
  if (seconds >= 60) {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${String(s).padStart(2, "0")}`;
  }
  return `${seconds} с`;
}
