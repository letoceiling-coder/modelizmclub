import { describe, expect, it } from "vitest";
import { keyForScope, newPaymentKey, type PaymentAttempt } from "./idempotency";

/**
 * Ключ идемпотентности попытки оплаты.
 *
 * Проверяется здесь, а не живыми нажатиями: каждая живая проверка — заказ в
 * банке, ровно тот мусор, из-за которого всё и затевалось (44 висящих
 * `pending` на проде, старейший от 19.07).
 *
 * Сценарий из задачи — «два быстрых нажатия создают один платёж, три тоже
 * один, после успеха новая попытка создаёт новый» — здесь выражен через
 * ключ: одинаковый ключ бэкенд сводит в один платёж, разный — в разные.
 */
describe("keyForScope", () => {
  const counter = () => {
    let n = 0;

    return () => `key-${++n}`;
  };

  it("второе и третье нажатие получают тот же ключ", () => {
    const mint = counter();
    let attempt: PaymentAttempt | null = null;

    attempt = keyForScope(attempt, "subscription:month:gateway", mint);
    const first = attempt.key;
    attempt = keyForScope(attempt, "subscription:month:gateway", mint);
    attempt = keyForScope(attempt, "subscription:month:gateway", mint);

    expect(attempt.key).toBe(first);
    expect(attempt.key).toBe("key-1");
  });

  it("после сброса попытка новая — ключ другой", () => {
    // Сброс зовётся после успешной оплаты: следующая покупка того же тарифа
    // обязана стать отдельным платежом, иначе второй месяц подписки просто
    // не создастся — бэкенд вернёт прошлый платёж.
    const mint = counter();
    const first = keyForScope(null, "subscription:month:gateway", mint).key;
    const second = keyForScope(null, "subscription:month:gateway", mint).key;

    expect(second).not.toBe(first);
  });

  it("смена того, за что платят, — тоже новая попытка", () => {
    // Человек передумал и выбрал другой тариф, не уходя со страницы.
    // Прежний ключ означал бы, что банк вернёт заказ на старую сумму.
    const mint = counter();
    let attempt = keyForScope(null, "subscription:month:gateway", mint);
    const monthly = attempt.key;
    attempt = keyForScope(attempt, "subscription:year:gateway", mint);

    expect(attempt.key).not.toBe(monthly);
    expect(attempt.scope).toBe("subscription:year:gateway");
  });

  it("возврат к прежней области даёт новый ключ, а не прежний", () => {
    // Состояние хранит одну попытку, а не историю: month → year → month
    // это третья попытка, и платёж должен быть третьим. Иначе возврат к
    // первому выбору воскресил бы заказ, от которого человек уже отказался.
    const mint = counter();
    let attempt = keyForScope(null, "subscription:month:gateway", mint);
    const firstMonthly = attempt.key;
    attempt = keyForScope(attempt, "subscription:year:gateway", mint);
    attempt = keyForScope(attempt, "subscription:month:gateway", mint);

    expect(attempt.key).not.toBe(firstMonthly);
  });
});

describe("newPaymentKey", () => {
  it("выдаёт разные значения", () => {
    const keys = new Set(Array.from({ length: 50 }, () => newPaymentKey()));

    expect(keys.size).toBe(50);
  });

  it("укладывается в 128 символов, которые принимает сервер", () => {
    // `idempotency_key` в CreatePaymentController: string, max:128.
    expect(newPaymentKey().length).toBeLessThanOrEqual(128);
  });
});
