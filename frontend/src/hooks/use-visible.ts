import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Сообщает, показался ли узел на экране хоть раз.
 *
 * Нужен там, где данные принадлежат блоку, которого на узком экране нет
 * вовсе. Правая колонка сообщества спрятана до 1024 через `display: none`, но
 * в разметке присутствует всегда — значит её компонент монтируется и на
 * телефоне, и запросы из него уходили бы впустую. Наблюдатель пересечений
 * это ловит сам: у скрытого узла пересечения не бывает, и обещание «загрузим,
 * когда понадобится» держится без проверки ширины окна.
 *
 * Возвращает `false` до первого показа и `true` навсегда после: данные,
 * однажды загруженные, не нужно перезапрашивать при прокрутке.
 */
export function useVisibleOnce<T extends HTMLElement>(): {
  ref: (node: T | null) => void;
  visible: boolean;
} {
  const [visible, setVisible] = useState(false);
  const observerRef = useRef<IntersectionObserver | null>(null);

  useEffect(() => () => observerRef.current?.disconnect(), []);

  const ref = useCallback(
    (node: T | null) => {
      observerRef.current?.disconnect();
      // Уже показывались — наблюдать нечего, и вешать наблюдатель заново
      // на каждый повторный рендер незачем.
      if (!node || visible) return;

      if (typeof IntersectionObserver === "undefined") {
        setVisible(true);
        return;
      }

      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((e) => e.isIntersecting)) {
            setVisible(true);
            observer.disconnect();
          }
        },
        // Небольшой запас: колонку начинаем наполнять чуть раньше, чем она
        // доедет до края экрана, иначе карточки появляются на глазах.
        { rootMargin: "200px" },
      );

      observer.observe(node);
      observerRef.current = observer;
    },
    [visible],
  );

  return { ref, visible };
}
