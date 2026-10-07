import { useCallback, useEffect, useState, type RefObject } from "react";

/**
 * Горизонтальный ряд, который прокручивается всем, чем человек пытается.
 *
 * Разбор 16.09: у ряда вкладок мессенджера был только нативный overflow-x.
 * Пальцем по телефону он ехал, а колесо мыши и перетаскивание давали ноль —
 * на всех пяти ширинах видно две вкладки из шести, остальные недоступны без
 * тачпада. Замер: wheel deltaY 300 → scrollLeft 0, drag 200 px → 0.
 *
 * Свайп пальцем остаётся нативным, здесь — колесо и мышь.
 */

/** С какого смещения нажатие становится перетаскиванием, а не кликом. */
export const DRAG_THRESHOLD_PX = 5;

/**
 * Куда уехать от вертикального колеса. null — ряд тут ни при чём: колесо
 * уже горизонтальное (тачпад, Shift) или ряд упёрся в край, и прокрутку
 * нужно отдать странице, а не глотать.
 */
export function wheelScrollTarget(
  deltaX: number,
  deltaY: number,
  scrollLeft: number,
  maxScroll: number,
): number | null {
  if (maxScroll <= 0) return null;
  if (Math.abs(deltaX) >= Math.abs(deltaY)) return null;
  const next = Math.min(maxScroll, Math.max(0, scrollLeft + deltaY));
  if (Math.abs(next - scrollLeft) < 0.5) return null;
  return next;
}

/**
 * Узел ряда — и он может появиться ПОЗЖЕ первого кадра.
 *
 * Имя латиницей, хотя остальное здесь по-русски: правило линта
 * `react-hooks/rules-of-hooks` узнаёт свой хук по `use` плюс заглавная
 * буква ASCII, и на `useУзелРяда` оно ругалось ошибкой — то есть считало
 * хук обычной функцией и перестало бы проверять порядок вызовов внутри.
 *
 * У маршрутов с ранним возвратом ряда в первом кадре нет вовсе: `/friends`
 * до разбора сессии рисует гостевую заглушку, и `ref.current` в эффекте
 * монтирования равен null. Эффект, привязанный только к монтированию,
 * после этого не прицеплялся никогда — ни колеса, ни стрелок, хотя ряд на
 * экране уже был и страница работала.
 *
 * Поймано инструментом, а не чтением: запись внутри пересчёта краёв не
 * появилась ни разу, тогда как сам хук вызывался 18 раз. То есть выполнялось
 * тело, но не эффект.
 *
 * Эффект без списка зависимостей выполняется после каждой отрисовки и стоит
 * одно сравнение; состояние меняется только при смене узла.
 */
function useRowNode(ref: RefObject<HTMLElement | null>): HTMLElement | null {
  const [узел, setУзел] = useState<HTMLElement | null>(null);
  useEffect(() => {
    if (ref.current !== узел) setУзел(ref.current);
  });
  return узел;
}

export function useScrollRow(ref: RefObject<HTMLElement | null>, deps: readonly unknown[] = []) {
  const узелРяда = useRowNode(ref);
  useEffect(() => {
    const row = узелРяда;
    if (!row) return;

    const onWheel = (e: WheelEvent) => {
      // Строки, а не пиксели (Firefox с колесом): одна строка ≈ 16 px.
      const scale = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? row.clientWidth : 1;
      const target = wheelScrollTarget(
        e.deltaX * scale,
        e.deltaY * scale,
        row.scrollLeft,
        row.scrollWidth - row.clientWidth,
      );
      if (target === null) return;
      e.preventDefault();
      row.scrollLeft = target;
    };

    let pointerId: number | null = null;
    let startX = 0;
    let startScroll = 0;
    let dragged = false;

    const onPointerDown = (e: PointerEvent) => {
      if (e.pointerType !== "mouse" || e.button !== 0) return;
      if (row.scrollWidth <= row.clientWidth) return;
      pointerId = e.pointerId;
      startX = e.clientX;
      startScroll = row.scrollLeft;
      dragged = false;
    };
    const onPointerMove = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      const dx = e.clientX - startX;
      if (!dragged) {
        if (Math.abs(dx) < DRAG_THRESHOLD_PX) return;
        dragged = true;
        // Захват только после порога: иначе клик по вкладке достаётся ряду.
        try {
          row.setPointerCapture(e.pointerId);
        } catch {
          /* указатель уже отпущен */
        }
        row.style.cursor = "grabbing";
      }
      row.scrollLeft = startScroll - dx;
    };
    const endDrag = (e: PointerEvent) => {
      if (pointerId !== e.pointerId) return;
      pointerId = null;
      row.style.cursor = "";
      try {
        row.releasePointerCapture(e.pointerId);
      } catch {
        /* не был захвачен */
      }
    };
    // Отпускание после перетаскивания не должно переключать вкладку.
    const onClickCapture = (e: MouseEvent) => {
      if (!dragged) return;
      dragged = false;
      e.preventDefault();
      e.stopPropagation();
    };
    // Браузер сам тащит кнопки и ссылки как картинки — это перебивает ряд.
    const onDragStart = (e: DragEvent) => e.preventDefault();

    row.addEventListener("wheel", onWheel, { passive: false });
    row.addEventListener("pointerdown", onPointerDown);
    row.addEventListener("pointermove", onPointerMove);
    row.addEventListener("pointerup", endDrag);
    row.addEventListener("pointercancel", endDrag);
    row.addEventListener("click", onClickCapture, true);
    row.addEventListener("dragstart", onDragStart);
    return () => {
      row.removeEventListener("wheel", onWheel);
      row.removeEventListener("pointerdown", onPointerDown);
      row.removeEventListener("pointermove", onPointerMove);
      row.removeEventListener("pointerup", endDrag);
      row.removeEventListener("pointercancel", endDrag);
      row.removeEventListener("click", onClickCapture, true);
      row.removeEventListener("dragstart", onDragStart);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [узелРяда, ...deps]);
}

/* ──────────────────────────────────────────────────────────────────────
   Края ряда: стрелки для мыши и затухание

   Колесо и перетаскивание выше появились 16.09 и закрыли «ряд не едет
   вовсе». Осталось то, чего по ним не видно: куда ехать. Полоса прокрутки
   у всех рядов скрыта (`no-scrollbar`), и человек с мышью не знает, что
   справа ещё что-то есть, — а узнав, всё равно должен догадаться покрутить
   колесом над самим рядом.

   Жалоба владельца 06.10: ряд вкладок профиля обрезан справа, мышью до
   остальных вкладок не добраться. Обход всех строк вкладок и фильтров
   показал класс, а не одно место (замер, вошедший, колесо над строкой):

   | Где | Ширина | Переполнение | Колесо | Стрелки |
   | --- | --- | --- | --- | --- |
   | профиль, вкладки | 360 | 746 px | нет | нет |
   | профиль, вкладки | 1280 | 501 px | нет | нет |
   | лента, фильтры | 360 | 180 px | нет | нет |
   | обзоры, фильтры | 360 | 75 px | нет | нет |
   | мои объявления | 360 | 431 px | есть | нет |
   | сообщения, разделы | 360 | 172 px | есть | нет |

   Пальцем все шесть листались родной прокруткой — поэтому на телефоне
   ничего не заметно, а мышью часть элементов была недостижима вовсе.
   ────────────────────────────────────────────────────────────────────── */

/** Ширина затухания у края. */
export const ЗАТУХАНИЕ_PX = 24;
/**
 * Запас, с которым стрелка подводит элемент к краю ряда.
 *
 * Сама стрелка шириной 28 стоит поверх края, и над ней ещё затухание в 24.
 * Без запаса подведённый элемент оказывался ровно под ними.
 */
const ЗАПАС_PX = 32;

export interface КраяРяда {
  /** Есть ли куда листать. Первый кадр — «некуда»: края считаются из
   *  раскладки, которой на сервере нет, и любое другое значение разошлось
   *  бы с серверной разметкой. */
  края: { слева: boolean; справа: boolean };
  /** Листнуть до следующего (или предыдущего) элемента ряда. */
  листать: (куда: -1 | 1) => void;
  /** Готовая маска затухания для `style.maskImage`. */
  маска: string;
}

/**
 * Края ряда и шаг листания. Дополняет `useScrollRow`, а не заменяет его:
 * тот слушает колесо и мышь, этот говорит, куда ещё можно уехать.
 */
export function useRowEdges(
  ref: RefObject<HTMLElement | null>,
  deps: readonly unknown[] = [],
): КраяРяда {
  const узелРяда = useRowNode(ref);
  const [края, setКрая] = useState({ слева: false, справа: false });

  const пересчитать = useCallback(() => {
    const row = узелРяда;
    if (!row) return;
    const предел = row.scrollWidth - row.clientWidth;
    const слева = row.scrollLeft > 1;
    const справа = предел > 1 && row.scrollLeft < предел - 1;
    setКрая((п) => (п.слева === слева && п.справа === справа ? п : { слева, справа }));
  }, [узелРяда]);

  useEffect(() => {
    const row = узелРяда;
    if (!row) return;
    пересчитать();
    row.addEventListener("scroll", пересчитать, { passive: true });
    let observer: ResizeObserver | undefined;
    if (typeof ResizeObserver !== "undefined") {
      observer = new ResizeObserver(пересчитать);
      observer.observe(row);
      /* Размеры элементов меняются уже после первого кадра: счётчики
         приходят запросами и добавляют кружки. */
      for (const el of Array.from(row.children)) observer.observe(el);
    }
    /*
     * Состав ряда тоже меняется позже — и это не то же, что размер.
     *
     * У обзоров категории приезжают запросом: на первом кадре в ряду одна
     * кнопка, переполнения нет, края считаются как «листать некуда». Потом
     * приходят категории, ряд переполняется на 75 px — а `ResizeObserver`
     * молчит: сам ряд во всю ширину, его размер не изменился, а новых детей
     * он не слушает, потому что подписка сделана по старому составу.
     *
     * Так и вышло: маска и `overflow-y` на месте, стрелок ноль. Поймано
     * обходом всех рядов, а не чтением.
     *
     * `MutationObserver` на childList перезакрепляет размерного сторожа на
     * новых детях и пересчитывает края — поэтому вызывающему не нужно
     * помнить про `deps` с длиной списка.
     */
    let состав: MutationObserver | undefined;
    if (typeof MutationObserver !== "undefined") {
      состав = new MutationObserver(() => {
        if (observer) {
          observer.disconnect();
          observer.observe(row);
          for (const el of Array.from(row.children)) observer.observe(el);
        }
        пересчитать();
      });
      состав.observe(row, { childList: true });
    }
    return () => {
      row.removeEventListener("scroll", пересчитать);
      observer?.disconnect();
      состав?.disconnect();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [узелРяда, пересчитать, ...deps]);

  /*
   * Стрелка листает ДО СЛЕДУЮЩЕГО элемента, а не на долю ширины ряда.
   *
   * Сначала шаг был 70 % ширины, и на 360 это оставляло вкладку между
   * остановками. Замер 06.10, профиль, 360 (ряд 302, предел 746), нажатия
   * правой стрелки до упора:
   *
   *   шаг 0  scrollLeft 0    Публикации✓ Репосты✓
   *   шаг 1  scrollLeft 211  Объявления✓ Отзывы✓
   *   шаг 2  scrollLeft 422  Сообщества✓
   *   шаг 3  scrollLeft 633  ни одной целиком
   *   шаг 4  scrollLeft 746  Заблокированные✓ О себе✓
   *
   * «Приглашённые» (136 px) не оказывались целиком видны ни на одной
   * остановке: 7 вкладок из 8. Нажать её было можно — она выглядывала, — но
   * прочитать целиком нельзя, а Е3 требует достижимости, а не выглядывания.
   * С шагом до следующего элемента стало 8 из 8.
   */
  const листать = useCallback(
    (куда: -1 | 1) => {
      const row = узелРяда;
      if (!row) return;
      /*
       * Накладки не считаются элементами ряда. У вкладок друзей
       * подчёркивание — отдельный ребёнок с `position: absolute`, и шаг «до
       * следующего» уводил бы к нему, а не к следующей вкладке.
       */
      const элементы = (Array.from(row.children) as HTMLElement[]).filter(
        (el) => getComputedStyle(el).position !== "absolute",
      );
      const левый = row.scrollLeft;
      const правый = левый + row.clientWidth;
      if (куда === 1) {
        const следующий = элементы.find((el) => el.offsetLeft + el.offsetWidth > правый - 1);
        const цель = следующий
          ? следующий.offsetLeft + следующий.offsetWidth - row.clientWidth + ЗАПАС_PX
          : row.scrollWidth;
        row.scrollTo({ left: Math.min(row.scrollWidth, цель), behavior: "smooth" });
        return;
      }
      const предыдущий = [...элементы].reverse().find((el) => el.offsetLeft < левый + 1);
      const цель = предыдущий ? предыдущий.offsetLeft - ЗАПАС_PX : 0;
      row.scrollTo({ left: Math.max(0, цель), behavior: "smooth" });
    },
    [узелРяда],
  );

  /*
   * Затухание — маской, а не накладкой: накладка поверх ряда перехватывала
   * бы нажатия по крайнему элементу. С нулевой шириной с обеих сторон
   * выражение сводится к «без маски».
   */
  const маска = `linear-gradient(to right, transparent 0, #000 ${
    края.слева ? ЗАТУХАНИЕ_PX : 0
  }px, #000 calc(100% - ${края.справа ? ЗАТУХАНИЕ_PX : 0}px), transparent 100%)`;

  return { края, листать, маска };
}
