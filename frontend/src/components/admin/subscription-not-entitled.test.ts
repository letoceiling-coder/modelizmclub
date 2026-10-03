import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mapAdminSubscription } from "@/lib/api/admin";

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
