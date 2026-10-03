import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapAdminSubscription, живаяПодписка } from "@/lib/api/admin";

/**
 * Живая строка подписки, которой ворота отказывают.
 *
 * 03.10 на проде у 1201 строка жила до 24.02.2027, карточка показывала
 * «активна до 24.02.2027» и кнопку «Продлить подписку», а человек на
 * каждом закрытом действии получал окно оплаты: оплата была сделана
 * тестовым эквайрингом, прод с тех пор переключён на боевой.
 *
 * У такого состояния теперь своё имя — `not_entitled`, и его обязаны
 * называть оба места, где админ видит подписку. Молчаливое «нет»
 * спрятало бы саму строку, а «активна» лгало бы о доступе.
 */
const читать = (имя: string) => readFileSync(join(import.meta.dirname, имя), "utf8");

describe("«оплата не подтверждена» названа своими словами", () => {
  it("маппер доносит состояние с сервера", () => {
    const s = mapAdminSubscription({
      status: "not_entitled",
      is_active: false,
      ends_at: "2027-02-24T11:54:19+03:00",
      auto_renew: true,
    });
    expect(s.status).toBe("not_entitled");
    expect(s.isActive).toBe(false);
    // Срок остаётся: админу нужно видеть саму строку, а не только отказ.
    expect(s.endsAt).toBe("2027-02-24T11:54:19+03:00");
  });

  it("карточка не называет такую подписку ни активной, ни отсутствующей", () => {
    const текст = читать("AdminUserCard.tsx");
    expect(текст).toContain('card.subscription.status === "not_entitled"');
    expect(текст).toContain("оплата не подтверждена");
  });

  it("у ячейки на панели есть своя подпись", () => {
    const текст = читать("AdminDashboardSection.tsx");
    expect(текст).toMatch(/not_entitled:\s*\{\s*label:/);
  });
});

/**
 * Живая строка — не то же, что открытый доступ, и путать их опасно.
 *
 * По `isActive` кнопка в списке называлась «Выдать подписку» и посылала
 * `activate`, а он считал срок от сегодня: у 1201 один клик отнял бы
 * шестнадцать месяцев живого срока. На панели по тому же признаку
 * пропадала кнопка «Снять» у подписки, которую как раз и надо снять.
 */
describe("живая строка отличается от открытого доступа", () => {
  const срок = (сдвигДней: number) => new Date(Date.now() + сдвигДней * 86_400_000).toISOString();

  it("строка без подтверждённой оплаты всё равно живая", () => {
    expect(
      живаяПодписка({
        status: "not_entitled",
        isActive: false,
        endsAt: срок(500),
        autoRenew: true,
      }),
    ).toBe(true);
  });

  it("открытый доступ — живая строка", () => {
    expect(
      живаяПодписка({ status: "active", isActive: true, endsAt: срок(30), autoRenew: true }),
    ).toBe(true);
  });

  it("истёкшая, снятая и отсутствующая — не живые", () => {
    for (const status of ["expired", "cancelled", "none"] as const) {
      expect(
        живаяПодписка({ status, isActive: false, endsAt: срок(500), autoRenew: false }),
        `status=${status} не должен считаться живым`,
      ).toBe(false);
    }
  });

  it("строка с прошедшим сроком не живая, как бы её ни назвали", () => {
    expect(
      живаяПодписка({
        status: "not_entitled",
        isActive: false,
        endsAt: срок(-1),
        autoRenew: true,
      }),
    ).toBe(false);
  });

  it("кнопки админки смотрят на живую строку, а не на доступ", () => {
    const список = читать("AdminUsersSection.tsx");
    expect(список).toContain('живаяПодписка(строка.subscription) ? "extend" : "activate"');
    expect(
      список,
      "выбор действия по isActive отнимает срок: activate считает от сегодня",
    ).not.toContain('строка.subscription.isActive ? "extend"');

    const панель = читать("AdminDashboardSection.tsx");
    expect(панель).toContain("есть_живая_строка && (");
    expect(панель, "неизвестное состояние не должно ронять раздел").toContain(
      "?? SUBSCRIPTION_LABEL.none",
    );
  });
});
