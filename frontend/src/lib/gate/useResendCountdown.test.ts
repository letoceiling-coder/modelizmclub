import { describe, expect, it } from "vitest";
import { formatCountdown, secondsLeft } from "./useResendCountdown";

/**
 * Отсчёт до следующей отправки SMS.
 *
 * Проверяется здесь, а не живой отправкой: каждая живая проверка — настоящее
 * сообщение и шаг к пределу, ровно к тому, из-за которого всё и затевалось.
 */
describe("secondsLeft", () => {
  const t0 = 1_757_000_000_000;

  it("считает остаток по часам, а не по числу тиков", () => {
    // Вкладку свернули, таймер срабатывал реже — остаток всё равно верный.
    expect(secondsLeft(t0 + 60_000, t0)).toBe(60);
    expect(secondsLeft(t0 + 60_000, t0 + 30_000)).toBe(30);
    expect(secondsLeft(t0 + 60_000, t0 + 59_500)).toBe(1);
  });

  it("не уходит в минус после срока", () => {
    expect(secondsLeft(t0 + 60_000, t0 + 60_000)).toBe(0);
    expect(secondsLeft(t0 + 60_000, t0 + 120_000)).toBe(0);
  });

  it("округляет вверх, чтобы не разблокировать раньше сервера", () => {
    // Полсекунды до срока — это ещё «1», а не «0»: иначе кнопка оживает
    // раньше, чем истечёт пауза на сервере, и человек ловит отказ.
    expect(secondsLeft(t0 + 500, t0)).toBe(1);
  });

  it("отсутствие срока — не блокировка", () => {
    // Отказ оператора приходит без retry_after: ждать нечего, надо править
    // номер, и кнопка блокироваться не должна.
    expect(secondsLeft(0, t0)).toBe(0);
  });
});

describe("formatCountdown", () => {
  it("секунды до минуты", () => {
    expect(formatCountdown(47)).toBe("47 с");
    expect(formatCountdown(59)).toBe("59 с");
  });

  it("минуты с ведущим нулём", () => {
    expect(formatCountdown(60)).toBe("1:00");
    expect(formatCountdown(65)).toBe("1:05");
    // Тот самый остаток из журнала 05.09, с которого начался разбор.
    expect(formatCountdown(125)).toBe("2:05");
  });
});
