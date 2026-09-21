import { describe, expect, it } from "vitest";
import { dealCancel } from "@/lib/deals/cancel";

describe("отмена безопасной сделки", () => {
  it("неоплаченную сделку можно бросить, и это не возврат", () => {
    // 20.09 у такой сделки на странице не было ни одной кнопки: страница
    // считала отмену недоступной, хотя сервер её разрешал.
    expect(dealCancel({ status: "created", can: { cancel: true } })).toEqual({
      allowed: true,
      kind: "abandon",
    });
  });

  it("оплаченная отменяется возвратом", () => {
    expect(dealCancel({ status: "paid", can: { cancel: true } })).toEqual({
      allowed: true,
      kind: "refund",
    });
  });

  it("отправленная — тоже возврат", () => {
    expect(dealCancel({ status: "shipped", can: { cancel: true } })).toEqual({
      allowed: true,
      kind: "refund",
    });
  });

  it("слово сервера сильнее списка состояний", () => {
    // Если сервер отмену запретил — кнопки нет, каким бы ни было состояние.
    expect(dealCancel({ status: "paid", can: { cancel: false } })).toEqual({ allowed: false });
  });

  it("ответ без `can` разбирается по тому же списку, что и политика", () => {
    expect(dealCancel({ status: "created" })).toEqual({ allowed: true, kind: "abandon" });
    expect(dealCancel({ status: "paid" })).toEqual({ allowed: true, kind: "refund" });
    expect(dealCancel({ status: "completed" })).toEqual({ allowed: false });
    expect(dealCancel({ status: "cancelled" })).toEqual({ allowed: false });
  });
});
