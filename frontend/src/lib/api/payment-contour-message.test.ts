import { describe, expect, it } from "vitest";
import { ApiError } from "@/lib/api/client";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";

/**
 * Отказ платёжного контура доходит до человека словами.
 *
 * Сервер отвечает 503 с кодом `payment_contour_unavailable`, когда шлюз не
 * настроен и подменять его подменным нельзя. Ветка `status >= 500` в
 * `formatApiErrorMessage` заменяла сообщение сервера общим «Сервис временно
 * недоступен. Попробуйте позже.» — то есть советовала повторить то, что не
 * изменится, пока контур не настроят.
 *
 * Общее поведение для пятисоток при этом остаётся: внутренние тексты наружу
 * не нужны, и проверка ниже это сторожит.
 */
describe("отказ платёжного контура", () => {
  const ошибка = (status: number, payload: unknown, message: string) =>
    new ApiError(status, message, undefined, payload as Record<string, unknown>);

  it("называет причину, а не «попробуйте позже»", () => {
    const текст = formatApiErrorMessage(
      ошибка(
        503,
        {
          code: "payment_contour_unavailable",
          message: "Оплата временно недоступна: платёжный шлюз не настроен.",
        },
        "Оплата временно недоступна: платёжный шлюз не настроен.",
      ),
      "Не удалось оформить оплату",
    );
    expect(текст).toContain("платёжный шлюз не настроен");
    expect(текст).not.toContain("Попробуйте позже");
  });

  it("обычная пятисотка по-прежнему не выносит текст сервера наружу", () => {
    const текст = formatApiErrorMessage(
      ошибка(
        500,
        { message: 'SQLSTATE[42P01]: relation "posts" does not exist' },
        "SQLSTATE[42P01]",
      ),
      "",
    );
    expect(текст).toBe("Сервис временно недоступен. Попробуйте позже.");
    expect(текст).not.toContain("SQLSTATE");
  });
});
