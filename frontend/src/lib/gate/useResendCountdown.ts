import { useCallback, useEffect, useRef, useState } from "react";

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
      setLeft(Math.max(0, Math.ceil((untilRef.current - Date.now()) / 1000)));
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
