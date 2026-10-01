import { describe, expect, it } from "vitest";

import { promoFormProblem, type PromoFormValues } from "./promo-form";

const годная: PromoFormValues = {
  code: "SPRING25",
  type: "percent",
  discount: 25,
  limit: 50,
  startsAt: "",
  expiresAt: "2026-12-31",
};

function спросить(part: Partial<PromoFormValues>, usedCount: number | null = null) {
  return promoFormProblem({
    form: { ...годная, ...part },
    audience: "all",
    audienceCount: 0,
    usedCount,
  });
}

describe("проверка формы промокода", () => {
  it("годная форма проходит", () => {
    expect(спросить({})).toBeNull();
  });

  it("без кода и без срока — не пускает", () => {
    expect(спросить({ code: "   " })?.key).toBe("errCode");
    expect(спросить({ expiresAt: "" })?.key).toBe("errExpires");
  });

  it("процент вне 1…100 — не пускает, а у суммы такого предела нет", () => {
    expect(спросить({ discount: 0 })?.key).toBe("errDiscount");
    expect(спросить({ discount: 101 })?.key).toBe("errDiscount");
    expect(спросить({ type: "fixed", discount: 5000 })).toBeNull();
  });

  it("начало позже конца — не пускает, а один день проходит", () => {
    expect(спросить({ startsAt: "2026-12-31", expiresAt: "2026-12-01" })?.key).toBe("errOrder");
    expect(спросить({ startsAt: "2026-12-31", expiresAt: "2026-12-31" })).toBeNull();
  });

  it("круг «перечисленные» без людей — не пускает", () => {
    expect(
      promoFormProblem({ form: годная, audience: "selected", audienceCount: 0, usedCount: null })
        ?.key,
    ).toBe("errAudienceEmpty");
  });
});

describe("предел применений при правке", () => {
  it("не может быть ниже уже применённых, и число называется", () => {
    const беда = спросить({ limit: 10 }, 34);

    expect(беда?.key).toBe("errLimitBelowUsed");
    expect(беда?.count).toBe(34);
  });

  it("равный числу применённых — можно: так акция и закрывается", () => {
    expect(спросить({ limit: 34 }, 34)).toBeNull();
  });

  it("при создании правила нет — применений ещё ноль", () => {
    // `usedCount: null` и означает «заводим новую».
    expect(спросить({ limit: 1 }, null)).toBeNull();
  });
});
