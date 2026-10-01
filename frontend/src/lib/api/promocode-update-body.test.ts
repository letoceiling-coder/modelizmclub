import { beforeEach, describe, expect, it, vi } from "vitest";

import { updateAdminPromocode } from "./admin";

/**
 * Что именно уходит на сервер при правке промокода.
 *
 * Проверка по тексту файла этого не ловила: ревью нашло, что форма
 * жёстко слала `scope: "listing_placement"`, то есть «поправил срок»
 * молча переводило акцию в раздел размещения объявлений и выключало её
 * там, где она действовала. Поле в форме не показано и менять его никто
 * не просил. Теперь `scope` не шлётся вовсе — отсутствующее поле сервер
 * не трогает, — и это утверждение, а не намерение.
 */
let тела: unknown[] = [];

beforeEach(() => {
  тела = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, init?: { body?: string; method?: string }) => {
      тела.push(init?.body ? JSON.parse(init.body) : null);

      return new Response(JSON.stringify({ data: {} }), {
        status: 200,
        headers: { "content-type": "application/json" },
      });
    }),
  );
});

function тело(): Record<string, unknown> {
  expect(тела, "запрос не ушёл — проверять нечего").toHaveLength(1);

  return тела[0] as Record<string, unknown>;
}

const годный = {
  code: "SPRING25",
  type: "percent" as const,
  value: 25,
  max_usages: 50,
  valid_until: "2026-12-31",
  is_active: true,
};

describe("тело правки промокода", () => {
  it("не содержит раздел акции", async () => {
    await updateAdminPromocode("SPRING25", годный);

    expect(Object.keys(тело())).not.toContain("scope");
  });

  it("несёт то, что человек правил", async () => {
    await updateAdminPromocode("SPRING25", { ...годный, value: 40 });

    expect(тело()).toMatchObject({
      code: "SPRING25",
      type: "percent",
      value: 40,
      max_usages: 50,
      valid_until: "2026-12-31",
      is_active: true,
    });
  });

  it("пустое начало уходит как null — сервер отличает «с начала» от «не задано»", async () => {
    await updateAdminPromocode("SPRING25", { ...годный, valid_from: "" });

    expect(тело().valid_from).toBeNull();
  });

  it("круг «все» снимает перечисленных, а не оставляет их висеть", async () => {
    await updateAdminPromocode("SPRING25", { ...годный, audience: "all", user_ids: [] });

    expect(тело()).toMatchObject({ audience: "all", user_ids: [] });
  });

  it("выключенную акцию не включает молча", async () => {
    await updateAdminPromocode("SPRING25", { ...годный, is_active: false });

    expect(тело().is_active).toBe(false);
  });
});
