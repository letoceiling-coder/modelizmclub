import { describe, expect, it } from "vitest";
import { estimateLines, exceedsLines, readingShift } from "@/lib/ui/clamp-text";

describe("estimateLines", () => {
  it("перенос начинает новую строку", () => {
    // Прод 17.09, 1440: тексты в 222–294 знака с двумя переносами занимали пять
    // строк при четырёх видимых, а порог «больше 330 знаков» кнопку не давал.
    const text = `${"а".repeat(150)}\n${"б".repeat(90)}\n${"в".repeat(50)}`;
    expect(text.length).toBeLessThan(330);
    expect(estimateLines(text, 82)).toBe(5);
    expect(exceedsLines(text, 82, 4)).toBe(true);
    // Та же длина одной строкой — четыре строки, кнопка не нужна.
    expect(exceedsLines("а".repeat(292), 82, 4)).toBe(false);
  });
  it("короткие строки считаются по одной", () => {
    expect(estimateLines("а\nб\nв\nг", 50)).toBe(4);
    expect(exceedsLines("а\nб\nв\nг", 50, 3)).toBe(true);
    expect(exceedsLines("а\nб\nв", 50, 3)).toBe(false);
  });
  it("пустой текст — ноль строк", () => {
    expect(estimateLines("", 50)).toBe(0);
  });
});

describe("readingShift", () => {
  const base = { textTopBefore: -40, controlTopBefore: 26, visibleTop: 0 };
  it("раскрытие возвращает начало текста на место, если браузер его увёл", () => {
    // Прод 17.09, 375: якорение прокрутки увело текст вверх на 81 px.
    expect(
      readingShift({ ...base, expanding: true, textTopAfter: -121, controlTopAfter: 26 }),
    ).toBe(-81);
  });
  it("раскрытие без сдвига ничего не крутит", () => {
    expect(
      readingShift({ ...base, expanding: true, textTopAfter: -40, controlTopAfter: 107 }),
    ).toBe(0);
  });
  it("сворачивание: кнопка ушла выше экрана — возвращаем под палец", () => {
    expect(
      readingShift({
        expanding: false,
        textTopBefore: -700,
        textTopAfter: -700,
        controlTopBefore: 40,
        controlTopAfter: -160,
        visibleTop: 0,
      }),
    ).toBe(-200);
  });
  it("сворачивание: кнопка осталась на экране — не трогаем", () => {
    expect(
      readingShift({
        expanding: false,
        textTopBefore: 495,
        textTopAfter: 495,
        controlTopBefore: 662,
        controlTopAfter: 561,
        visibleTop: 0,
      }),
    ).toBe(0);
  });
});
