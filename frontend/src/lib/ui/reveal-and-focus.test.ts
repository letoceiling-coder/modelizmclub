import { afterEach, describe, expect, it, vi } from "vitest";
import { revealAndFocus } from "./reveal-and-focus";

/**
 * jsdom в проекте нет — все тесты идут в среде node, а раскладку и фокус
 * проверяет браузер (замеры Playwright). Здесь проверяется ровно то, что
 * можно проверить без раскладки: с какими доводами помощник зовёт
 * `scrollIntoView` и `focus`, и что он уважает `prefers-reduced-motion`.
 *
 * Поэтому «узел» — простой объект нужной формы, а не элемент DOM: функции
 * ничего, кроме этих двух методов, от него не нужно.
 */
function узел() {
  return {
    scrollIntoView: vi.fn(),
    focus: vi.fn(),
  } as unknown as HTMLElement;
}

function поставитьНастройку(reduce: boolean) {
  (globalThis as { window?: unknown }).window = {
    matchMedia: (q: string) => ({ matches: q.includes("reduced-motion") ? reduce : false }),
  };
}

afterEach(() => {
  delete (globalThis as { window?: unknown }).window;
});

describe("revealAndFocus", () => {
  it("прокручивает узел в середину окна, а не к краю", () => {
    поставитьНастройку(false);
    const el = узел();
    expect(revealAndFocus(el)).toBe(true);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "smooth" });
  });

  it("ставит фокус, не давая ему прокручивать второй раз", () => {
    поставитьНастройку(false);
    const el = узел();
    revealAndFocus(el);
    // preventScroll обязателен: иначе focus() прижмёт поле к краю окна, под
    // клавиатуру, и прокрутка в середину, сделанная строкой выше, пропадёт.
    expect(el.focus).toHaveBeenCalledWith({ preventScroll: true });
  });

  it("при prefers-reduced-motion прокрутка мгновенная", () => {
    поставитьНастройку(true);
    const el = узел();
    revealAndFocus(el);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
  });

  it("на отсутствующем узле не падает и сообщает, что ничего не сделал", () => {
    поставитьНастройку(false);
    expect(revealAndFocus(null)).toBe(false);
    expect(revealAndFocus(undefined)).toBe(false);
  });

  it("без window (серверная отрисовка) прокрутка мгновенная, падения нет", () => {
    const el = узел();
    expect(revealAndFocus(el)).toBe(true);
    expect(el.scrollIntoView).toHaveBeenCalledWith({ block: "center", behavior: "auto" });
  });
});
