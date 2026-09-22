import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { разместитьОтклик } from "@/lib/ui/inline-feedback-place";

/**
 * Отклик на действие — рядом с кнопкой, а не в углу экрана.
 *
 * «Добавлено в избранное» в правом нижнем углу заставляет человека искать
 * глазами ответ на другом конце экрана — и это при том, что он смотрит на
 * сердечко, по которому только что нажал. На телефоне тост вдобавок
 * перекрывает содержимое.
 *
 * Тосты остаются для того, чего у кнопки не скажешь: отказов с объяснением,
 * фоновых событий, сообщений без источника на экране.
 */

const ЖИВЁТ_МС = 2200;

/**
 * На сервере `useLayoutEffect` ругается в консоль, а `useEffect` не успевает
 * до кадра. Приём уже принят в проекте — `lib/ui/clamp-text.ts`.
 */
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

interface Отклик {
  id: number;
  text: string;
  кнопка: DOMRect;
}

let показать: ((text: string, кнопка: DOMRect) => void) | null = null;
let счётчик = 0;

/**
 * Показать отклик у элемента. Возвращает, получилось ли.
 *
 * `false` — хоста нет (сервер, первый кадр) или элемента не существует. По
 * этому ответу вызывающий может сказать то же тостом, а не промолчать:
 * молчание на экране неотличимо от «ничего не произошло».
 */
export function inlineFeedback(anchor: Element | null, text: string): boolean {
  if (!anchor || !показать) return false;

  const кнопка = anchor.getBoundingClientRect();
  // Открепившийся или скрытый узел даёт нулевой прямоугольник — подпись
  // встала бы в левом верхнем углу, у чужого содержимого.
  if (кнопка.width === 0 && кнопка.height === 0) return false;

  показать(text, кнопка);

  return true;
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
   * до кадра. Иначе подпись успевала бы мигнуть в левом верхнем углу и
   * только потом встать на место.
   */
  useIsoLayoutEffect(() => {
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

    const убрать = () => setОтклик(null);
    const t = setTimeout(убрать, ЖИВЁТ_МС);

    /*
     * Прокрутка и поворот снимают подпись, а не двигают её.
     *
     * Координаты сняты один раз, ссылки на кнопку здесь нет. За две секунды
     * инерционная прокрутка уводит список на пол-экрана, и подпись осталась
     * бы висеть на старом месте — поверх постороннего содержимого и у чужой
     * кнопки. Снять дешевле и честнее, чем пересчитывать: действие уже
     * состоялось, а сердечко закрашено.
     */
    window.addEventListener("scroll", убрать, { passive: true, capture: true });
    window.addEventListener("resize", убрать);
    window.addEventListener("orientationchange", убрать);

    return () => {
      clearTimeout(t);
      window.removeEventListener("scroll", убрать, { capture: true });
      window.removeEventListener("resize", убрать);
      window.removeEventListener("orientationchange", убрать);
    };
  }, [отклик]);

  if (typeof document === "undefined") return null;

  return createPortal(
    /*
     * Живая область смонтирована всегда, меняется только текст. Область,
     * вставленная в дерево вместе с содержимым, экранным диктором не
     * объявляется — так «Добавлено в избранное» для незрячего пропало бы
     * совсем: у карточки каталога другого сообщения об этом нет.
     */
    <div
      role="status"
      aria-live="polite"
      className="pointer-events-none fixed z-[var(--z-toast)]"
      style={{
        top: место?.top ?? 0,
        left: место?.left ?? 0,
        // До расчёта места и без отклика подпись не видна: иначе она мигала
        // бы в углу.
        opacity: отклик && место ? 1 : 0,
      }}
    >
      {отклик && (
        <div
          key={отклик.id}
          ref={подписьRef}
          className="rounded-[var(--r-tag)] px-3 py-1.5 text-[13px] font-medium"
          style={{
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
        </div>
      )}
    </div>,
    document.body,
  );
}
