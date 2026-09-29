import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { insufficientPoints } from "./bonus-points";
import { ApiError } from "./client";

/**
 * Баллы тратятся — и интерфейс говорит об этом честно.
 *
 * До этой правки баллы можно было только заработать. Теперь ими платят за
 * размещение и продвижение, и главное в интерфейсе — не сам способ
 * оплаты, а поведение при нехватке: частичной оплаты нет, значит человеку
 * надо назвать, сколько не хватает, и не уводить его пополнять кошелёк —
 * баллы деньгами не пополняются.
 */
const ОКНО = join(
  import.meta.dirname,
  "..",
  "..",
  "components",
  "billing",
  "PaymentSourceDialog.tsx",
);
const КАРТОЧКА = join(
  import.meta.dirname,
  "..",
  "..",
  "components",
  "billing",
  "BonusPointsCard.tsx",
);
const ПОДПИСКА = join(import.meta.dirname, "..", "..", "routes", "subscription.tsx");

const читать = (путь: string) => readFileSync(путь, "utf8");

const отказ = (payload: Record<string, unknown>) =>
  new ApiError(422, "Не хватает 60 баллов. На счету 40.", undefined, payload);

describe("нехватка баллов", () => {
  it("узнаётся по коду и называет число", () => {
    const мало = insufficientPoints(
      отказ({
        code: "insufficient_points",
        message: "Не хватает 60 баллов. На счету 40.",
        points_short_by: 60,
        points_balance: 40,
      }),
    );

    expect(мало).not.toBeNull();
    expect(мало?.shortBy).toBe(60);
    expect(мало?.balance).toBe(40);
    expect(мало?.message).toContain("60");
  });

  /* Контроль: нехватка рублей — не нехватка баллов. Иначе человека увели
     бы пополнять кошелёк, который к баллам отношения не имеет. */
  it("не путается с нехваткой денег", () => {
    expect(insufficientPoints(отказ({ code: "insufficient_funds" }))).toBeNull();
  });

  it("чужие отказы не считает нехваткой", () => {
    expect(insufficientPoints(new ApiError(500, "Ошибка сервера"))).toBeNull();
    expect(insufficientPoints(new Error("не сеть"))).toBeNull();
  });
});

describe("интерфейс оплаты баллами", () => {
  it("окно выбора показывает способ только там, где он разрешён", () => {
    const окно = читать(ОКНО);

    expect(окно, "способ не заведён").toContain("allowPoints");
    expect(окно, "цена берётся не с сервера").toContain("listing_placement_points");
    expect(окно, "не сказано, сколько не хватает").toContain("Не хватает");
  });

  /*
   * Подписка баллами не оплачивается — решение, а не недоделка. Свойства
   * `allowPoints` у её окна быть не должно; сервер такой запрос тоже
   * отклоняет, это две половины одного правила.
   */
  it("подписка баллами не оплачивается", () => {
    const подписка = читать(ПОДПИСКА);
    const кусок = подписка.slice(подписка.indexOf("<PaymentSourceDialog"));

    expect(кусок.slice(0, 600)).not.toContain("allowPoints");
  });

  it("в кошельке сказано, что баллы не выводятся", () => {
    expect(читать(КАРТОЧКА)).toContain("не выводятся");
  });
});
