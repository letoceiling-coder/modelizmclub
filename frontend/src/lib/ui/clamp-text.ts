import { useEffect, useLayoutEffect, useState, type RefObject } from "react";
import { flushSync } from "react-dom";

/**
 * Обрезанный строками текст: сколько он занимает на самом деле и как его
 * раскрыть, не уронив читателя.
 *
 * Разбор 17.09 на проде, лента, 20 карточек с текстом.
 *
 * «Нет „Показать всё“». Кнопку решал порог по длине: больше 150 знаков на
 * телефоне, больше 330 на широком. На 1440 обрезаны 11 текстов, кнопка у 2:
 * тексты в 222–294 знака с двумя переносами занимают пять строк при
 * четырёх видимых, а порог переносов не видит.
 *
 * «Рывки при раскрытии». Если начало текста уже ушло под край экрана,
 * браузер держит на месте то, что ниже текста (scroll anchoring), и весь
 * прибавленный текст уезжает вверх: 81 px на 375 и 264 px на 1440. Человек
 * нажал «Показать ещё» и потерял строку, на которой остановился.
 */

/** Сколько строк займёт текст при такой ширине строки в знаках. */
export function estimateLines(text: string, charsPerLine: number): number {
  if (!text) return 0;
  return text
    .split("\n")
    .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / charsPerLine)), 0);
}

/**
 * Не влезет ли текст в столько строк. Оценка для первого кадра — сервер не
 * знает ширины, — поэтому с переносами: каждый начинает новую строку.
 */
export function exceedsLines(text: string, charsPerLine: number, lines: number): boolean {
  return estimateLines(text, charsPerLine) > lines;
}

// На сервере layout-эффекты не выполняются и предупреждают — там обычный.
const useIsoLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

/**
 * Обрезан ли элемент с line-clamp на самом деле. null — ещё не мерили:
 * первый кадр (и серверная разметка) идут по оценке, мера приходит до
 * отрисовки следующего. Пока текст раскрыт, мерить нечего — держим прошлое.
 */
export function useClampOverflow(
  ref: RefObject<HTMLElement | null>,
  expanded: boolean,
  text: string,
): boolean | null {
  const [overflows, setOverflows] = useState<boolean | null>(null);

  useIsoLayoutEffect(() => {
    const el = ref.current;
    if (!el || expanded) return;
    const check = () => setOverflows(el.scrollHeight > el.clientHeight + 2);
    check();
    if (typeof ResizeObserver === "undefined") return;
    const ro = new ResizeObserver(check);
    ro.observe(el);
    return () => ro.disconnect();
  }, [ref, expanded, text]);

  return overflows;
}

/**
 * На сколько прокрутить, чтобы раскрытие не сдвинуло читателя.
 *
 * Раскрытие — начало текста остаётся, где было: дописанное появляется
 * ниже, под последней прочитанной строкой. Сворачивание — если кнопка ушла
 * выше видимой области, возвращаем её под палец; если видна, не трогаем.
 */
export function readingShift(input: {
  expanding: boolean;
  textTopBefore: number;
  textTopAfter: number;
  controlTopBefore: number;
  controlTopAfter: number;
  visibleTop: number;
}): number {
  if (input.expanding) return input.textTopAfter - input.textTopBefore;
  if (input.controlTopAfter < input.visibleTop)
    return input.controlTopAfter - input.controlTopBefore;
  return 0;
}

function scrollParent(el: HTMLElement): HTMLElement | null {
  for (let node = el.parentElement; node; node = node.parentElement) {
    if (node === document.body || node === document.documentElement) return null;
    const { overflowY } = getComputedStyle(node);
    if ((overflowY === "auto" || overflowY === "scroll") && node.scrollHeight > node.clientHeight) {
      return node;
    }
  }
  return null;
}

/**
 * Переключить раскрытие без рывка. `commit` — сам setState; он выполняется
 * синхронно, чтобы измерить до и после в одном кадре.
 *
 * Якорение прокрутки на время переключения выключаем: иначе браузер сам
 * сдвинет страницу в следующем кадре, уже после нашей поправки.
 */
export function toggleClampInPlace(
  text: HTMLElement | null,
  control: HTMLElement | null,
  expanding: boolean,
  commit: () => void,
): void {
  if (!text || !control || typeof window === "undefined") {
    commit();
    return;
  }
  const scroller = scrollParent(text);
  const anchorHost = scroller ?? document.documentElement;
  const prevAnchor = anchorHost.style.overflowAnchor;
  anchorHost.style.overflowAnchor = "none";

  const textTopBefore = text.getBoundingClientRect().top;
  const controlTopBefore = control.getBoundingClientRect().top;
  flushSync(commit);
  const dy = readingShift({
    expanding,
    textTopBefore,
    textTopAfter: text.getBoundingClientRect().top,
    controlTopBefore,
    controlTopAfter: control.getBoundingClientRect().top,
    visibleTop: scroller ? scroller.getBoundingClientRect().top : 0,
  });
  if (Math.abs(dy) >= 1) {
    if (scroller) scroller.scrollTop += dy;
    else window.scrollBy(0, dy);
  }

  requestAnimationFrame(() =>
    requestAnimationFrame(() => {
      anchorHost.style.overflowAnchor = prevAnchor;
    }),
  );
}
