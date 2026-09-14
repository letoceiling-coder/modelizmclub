import { describe, expect, it } from "vitest";
import { formatDate } from "./date";

// Fixed clock: Thursday 3 Sept 2026, 14:32 local time.
const NOW = new Date(2026, 8, 3, 14, 32, 0);
const at = (y: number, m: number, d: number, h = 12, min = 0) => new Date(y, m, d, h, min, 0);

describe("formatDate relative", () => {
  it("under a minute is «только что»", () => {
    expect(formatDate(new Date(NOW.getTime() - 30_000), "relative", NOW)).toBe("только что");
  });

  it("under an hour counts minutes", () => {
    expect(formatDate(new Date(NOW.getTime() - 5 * 60_000), "relative", NOW)).toBe("5 мин назад");
    expect(formatDate(new Date(NOW.getTime() - 59 * 60_000), "relative", NOW)).toBe("59 мин назад");
  });

  it("same day shows «сегодня в HH:MM»", () => {
    expect(formatDate(at(2026, 8, 3, 9, 5), "relative", NOW)).toBe("сегодня в 09:05");
  });

  it("previous day shows «вчера в HH:MM»", () => {
    expect(formatDate(at(2026, 8, 2, 23, 59), "relative", NOW)).toBe("вчера в 23:59");
  });

  it("same year shows day, short month and time", () => {
    expect(formatDate(at(2026, 7, 22, 17, 33), "relative", NOW)).toBe("22 авг в 17:33");
  });

  it("earlier years drop the time and add the year", () => {
    expect(formatDate(at(2025, 7, 22, 17, 33), "relative", NOW)).toBe("22 авг 2025");
  });

  it("yesterday across a month boundary still reads «вчера»", () => {
    const firstOfMonth = at(2026, 8, 1, 10, 0);
    expect(formatDate(at(2026, 7, 31, 18, 0), "relative", firstOfMonth)).toBe("вчера в 18:00");
  });
});

describe("formatDate absolute and short", () => {
  it("absolute uses the genitive month", () => {
    expect(formatDate(at(2026, 7, 22, 17, 33), "absolute")).toBe("22 августа 2026, 17:33");
    expect(formatDate(at(2026, 4, 9, 8, 0), "absolute")).toBe("9 мая 2026, 08:00");
  });

  it("short is DD.MM.YY", () => {
    expect(formatDate(at(2026, 7, 22), "short")).toBe("22.08.26");
  });

  it("date is DD.MM.YYYY", () => {
    expect(formatDate(at(2026, 7, 22), "date")).toBe("22.08.2026");
  });
});

describe("formatDate inputs", () => {
  it("accepts ISO strings", () => {
    const iso = at(2026, 7, 22, 17, 33).toISOString();
    expect(formatDate(iso, "short")).toBe("22.08.26");
  });

  it("returns the input untouched when it is not a date", () => {
    expect(formatDate("вчера", "relative", NOW)).toBe("вчера");
  });

  it("returns an empty string for null, undefined and empty", () => {
    expect(formatDate(null)).toBe("");
    expect(formatDate(undefined)).toBe("");
    expect(formatDate("")).toBe("");
  });
});

describe("formatRevisionDate — не зависит от пояса того, кто рисует", () => {
  // Страница /rules приходит с сервера (Etc/UTC), а гидрируется у человека
  // в Москве. Дата в поясе рисующего давала разный текст — React #418 (D8).
  it("показывает московское время при любом поясе процесса", async () => {
    const { formatRevisionDate } = await import("@/components/legal/RulesDocumentView");
    expect(formatRevisionDate("2026-08-27T17:07:00Z")).toBe("27 августа 2026, 20:07");
    expect(formatRevisionDate("2026-12-31T21:30:00Z")).toBe("1 января 2027, 00:30");
  });
});
