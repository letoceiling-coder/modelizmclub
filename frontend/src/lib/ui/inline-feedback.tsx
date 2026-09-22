import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { разместитьОтклик } from "@/lib/ui/inline-feedback-place";

/**
 * Отклик на действие — рядом с кнопкой, а не в углу экрана.
 *
 * «Добавлено в избранное» в правом нижнем углу заставляет человека искать
 * глазами ответ на другом конце экрана — и это при том, что он смотрит на
 * сердечко, по которому только что нажал. На телефоне тост вдобавок
 * перекрывает содержимое и наезжает на соседние.
 *
 * Тосты остаются для того, чего у кнопки не скажешь: отказов с объяснением,
 * фоновых событий, сообщений без источника на экране.
 *
 * Подпись живёт полторы секунды и ничего не перекрывает: она уже вне потока
 * (портал в `body`) и не ловит указатель.
 */

const ЖИВЁТ_МС = 1500;

interface Отклик {
  id: number;
  text: string;
  кнопка: DOMRect;
}

let показать: ((text: string, кнопка: DOMRect) => void) | null = null;
let счётчик = 0;

/**
 * Показать отклик у элемента.
 *
 * Молча выходит, когда хоста нет: на сервере и до первого кадра показывать
 * некуда, а падать из-за подписи, которой человек не увидит, незачем.
 */
export function inlineFeedback(anchor: Element | null, text: string): void {
  if (!anchor || !показать) return;
  показать(text, anchor.getBoundingClientRect());
}

/** Хост монтируется один раз, рядом с тостами. */
export function InlineFeedbackHost() {
  const [отклик, setОтклик] = useState<Отклик | null>(null);
  const [место, setМесто] = useState<{ top: number; left: number } | null>(null);
  const подписьRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    показать = (text, кнопка) => {
      счётчик += 1;
      setМесто(null);
      setОтклик({ id: счётчик, text, кнопка });
    };

    return () => {
      показать = null;
    };
  }, []);

  /*
   * Размер подписи известен только после отрисовки, поэтому место считается
   * в `useLayoutEffect` — до кадра. Иначе подпись успевала бы мигнуть в
   * левом верхнем углу и только потом встать на место.
   */
  useLayoutEffect(() => {
    const узел = подписьRef.current;
    if (!отклик || !узел) return;

    const { width, height } = узел.getBoundingClientRect();
    const { top, left } = разместитьОтклик(
      отклик.кнопка,
      { width, height },
      { width: window.innerWidth, height: window.innerHeight },
    );
    setМесто({ top, left });
  }, [отклик]);

  useEffect(() => {
    if (!отклик) return;
    const t = setTimeout(() => setОтклик(null), ЖИВЁТ_МС);

    return () => clearTimeout(t);
  }, [отклик]);

  if (!отклик || typeof document === "undefined") return null;

  return createPortal(
    <div
      key={отклик.id}
      ref={подписьRef}
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed z-[var(--z-toast)] rounded-[var(--r-tag)] px-3 py-1.5 text-[13px] font-medium"
      style={{
        top: место?.top ?? 0,
        left: место?.left ?? 0,
        // До расчёта места подпись не видна: иначе она мигала бы в углу.
        opacity: место ? 1 : 0,
        background: "var(--foreground)",
        color: "var(--background)",
        boxShadow: "var(--shadow-card)",
        maxWidth: "calc(100vw - 16px)",
        whiteSpace: "nowrap",
        overflow: "hidden",
        textOverflow: "ellipsis",
      }}
    >
      {отклик.text}
    </div>,
    document.body,
  );
}
