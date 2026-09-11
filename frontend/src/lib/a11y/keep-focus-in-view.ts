/*
 * Фокус с клавиатуры не остаётся наполовину за краем прокручиваемого ряда.
 *
 * Браузер докручивает ряд к фокусу, только когда элемент целиком за краем;
 * частично видимый он оставляет как есть. На 375 так фишка «Сохранённое» в
 * ленте и вкладка «Сообщества» в мессенджере получали фокус с обрезанным
 * краем — и кольцо фокуса вместе с ним. Замер 11.09: элемент 273–385 при
 * видимой части ряда 8–367, прокрутка 0 и через секунду после Tab.
 *
 * Один обработчик на документ, а не правка в каждом ряду: рядов с
 * overflow-x-auto в коде 24, и чинить их поштучно — значит пропустить
 * двадцать пятый. Двигается только горизонталь и только при фокусе с
 * клавиатуры (:focus-visible): щелчок мышью по краю фишки ряд не дёргает.
 */

/** Запас от края ряда, чтобы кольцо не прилипало к границе. */
export const FOCUS_EDGE_PAD = 8;

interface Span {
  left: number;
  right: number;
}

/** На сколько сдвинуть ряд, чтобы элемент оказался в нём целиком. 0 — не нужно. */
export function horizontalFocusDelta(el: Span, row: Span, pad = FOCUS_EDGE_PAD): number {
  // Шире самого ряда — показываем начало: там подпись.
  if (el.right - el.left > row.right - row.left) return el.left - row.left - pad;
  if (el.left < row.left) return el.left - row.left - pad;
  if (el.right > row.right) return el.right - row.right + pad;
  return 0;
}

/** Ближайший предок, который прокручивается по горизонтали и сейчас не вмещает содержимое. */
function horizontalScroller(el: HTMLElement): HTMLElement | null {
  for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
    const overflowX = getComputedStyle(p).overflowX;
    if ((overflowX === "auto" || overflowX === "scroll") && p.scrollWidth > p.clientWidth + 1) {
      return p;
    }
  }
  return null;
}

function onFocusIn(event: FocusEvent) {
  const el = event.target;
  if (!(el instanceof HTMLElement) || !el.matches(":focus-visible")) return;
  // Замер в следующем кадре: элемент, целиком ушедший за край, браузер
  // докручивает сам — уже после focusin и ровно до края, без запаса. Считая
  // по геометрии до этой прокрутки, мы получали фишку вплотную к границе.
  requestAnimationFrame(() => {
    if (document.activeElement !== el) return;
    const row = horizontalScroller(el);
    if (!row) return;
    const delta = horizontalFocusDelta(el.getBoundingClientRect(), row.getBoundingClientRect());
    if (delta !== 0) row.scrollBy({ left: delta });
  });
}

/** Ставит обработчик на документ; возвращает функцию снятия. */
export function installKeepFocusInView(): () => void {
  document.addEventListener("focusin", onFocusIn);
  return () => document.removeEventListener("focusin", onFocusIn);
}
