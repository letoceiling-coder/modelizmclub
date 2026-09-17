import { describe, expect, it } from "vitest";
import { addInterest, resolveProfileCityId, splitInterests } from "./edit";

describe("addInterest", () => {
  it("два выбора подряд дают два направления", () => {
    let list = splitInterests("");
    list = addInterest(list, "Авиация", 10).list;
    list = addInterest(list, "Корабли", 10).list;
    expect(list).toEqual(["Авиация", "Корабли"]);
    expect(list.join(", ")).toBe("Авиация, Корабли");
  });

  it("повтор не дублирует", () => {
    expect(addInterest(["Авиация"], "Авиация", 10).list).toEqual(["Авиация"]);
  });

  it("сверх предела — отказ, список прежний", () => {
    const full = Array.from({ length: 10 }, (_, i) => `Н${i}`);
    expect(addInterest(full, "Ещё", 10)).toEqual({ list: full, error: "limit" });
  });
});

describe("resolveProfileCityId", () => {
  const saved = { savedId: 1, savedName: "Москва" };

  it("выбранный в подсказках город уходит своим id", () => {
    expect(resolveProfileCityId({ text: "Сочи", pickedId: 42, ...saved })).toEqual({ cityId: 42 });
  });

  it("стёртое поле стирает город", () => {
    expect(resolveProfileCityId({ text: "", pickedId: undefined, ...saved })).toEqual({
      cityId: null,
    });
  });

  it("нетронутое поле сохраняет прежний город", () => {
    expect(resolveProfileCityId({ text: "Москва", pickedId: 1, ...saved })).toEqual({ cityId: 1 });
    expect(resolveProfileCityId({ text: "Москва", pickedId: undefined, ...saved })).toEqual({
      cityId: 1,
    });
  });

  it("набранный, но не выбранный текст — ошибка, а не молчаливый null", () => {
    expect(resolveProfileCityId({ text: "Моск", pickedId: undefined, ...saved })).toEqual({
      error: "pick-from-list",
    });
  });
});
