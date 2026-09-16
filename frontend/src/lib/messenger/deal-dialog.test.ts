import { describe, expect, it } from "vitest";
import { isDealDialog } from "@/lib/messenger/deal-dialog";
import { mergeDeals, type OrdinaryDeal } from "@/lib/api/deals";
import type { SafeDeal } from "@/lib/api/safe-deals";

describe("isDealDialog", () => {
  it("чат безопасной сделки — сделка", () => {
    expect(isDealDialog({ type: "deal" })).toBe(true);
  });
  it("личный чат с отмеченной продажей — сделка", () => {
    expect(
      isDealDialog({
        type: "direct",
        ordinaryDeal: { id: "d1", role: "buyer", statusLabel: "Продано" },
      }),
    ).toBe(true);
  });
  it("личный чат с вопросом про объявление — не сделка", () => {
    expect(isDealDialog({ type: "direct" })).toBe(false);
  });
});

describe("mergeDeals", () => {
  const safe = (uuid: string, created: string | null, paid: string | null = null) =>
    ({ uuid, created_at: created, paid_at: paid }) as unknown as SafeDeal;
  const ordinary = (uuid: string, created: string) =>
    ({ uuid, created_at: created }) as unknown as OrdinaryDeal;

  it("сводит оба вида, новые сверху", () => {
    const out = mergeDeals(
      [safe("s-old", "2026-09-01T10:00:00Z"), safe("s-new", "2026-09-15T10:00:00Z")],
      [ordinary("o-mid", "2026-09-10T10:00:00Z")],
    );
    expect(out.map((i) => i.deal.uuid)).toEqual(["s-new", "o-mid", "s-old"]);
    expect(out.map((i) => i.kind)).toEqual(["safe", "ordinary", "safe"]);
  });
  it("безопасная без даты создания встаёт по дате оплаты", () => {
    const out = mergeDeals(
      [safe("s", null, "2026-09-20T10:00:00Z")],
      [ordinary("o", "2026-09-10T10:00:00Z")],
    );
    expect(out[0].deal.uuid).toBe("s");
  });
});
