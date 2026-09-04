import { useEffect, useState } from "react";

/**
 * Сколько пикселей снизу отъедает экранная клавиатура.
 *
 * На мобильных браузерах открытие клавиатуры не меняет ни innerHeight, ни
 * 100dvh — меняется только visualViewport. Без этой поправки композер и
 * последнее сообщение уезжают под клавиатуру. Возвращает 0 на десктопе и там,
 * где visualViewport недоступен, поэтому вызывающий код может просто класть
 * значение в padding-bottom.
 */
export function useVisualViewportInset(): number {
  const [inset, setInset] = useState(0);

  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;

    let frame = 0;
    const measure = () => {
      frame = 0;
      // Скрытая часть layout-вьюпорта = высота клавиатуры (плюс панель браузера,
      // если страница проскроллена внутри визуального вьюпорта).
      const hidden = window.innerHeight - viewport.height - viewport.offsetTop;
      setInset(hidden > 1 ? Math.round(hidden) : 0);
    };
    const schedule = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(measure);
    };

    measure();
    viewport.addEventListener("resize", schedule);
    viewport.addEventListener("scroll", schedule);
    return () => {
      if (frame) window.cancelAnimationFrame(frame);
      viewport.removeEventListener("resize", schedule);
      viewport.removeEventListener("scroll", schedule);
    };
  }, []);

  return inset;
}
