import { describe, expect, it } from "vitest";
import { pvzBounds, pvzFeatures } from "@/lib/delivery/pvz-features";
import type { CdekPickupPoint } from "@/lib/api/cdek";

const пункт = (id: string, lat: number | null, lon: number | null): CdekPickupPoint => ({
  id,
  name: `MSK${id}`,
  address: `Адрес ${id}`,
  latitude: lat,
  longitude: lon,
});

describe("точки для карты", () => {
  it("пункт без координат на карту не попадает", () => {
    const f = pvzFeatures([пункт("1", 55.75, 37.62), пункт("2", null, null)]);
    expect(f.map((x) => x.id)).toEqual(["1"]);
  });

  /*
   * Ради этого случая и написана проверка на ноль. СДЭК отдаёт нули у
   * пунктов, которым координаты не проставили; точка (0, 0) лежит в
   * Атлантике, и одна такая растягивает рамку на полмира — карта
   * открывалась бы океаном вместо города.
   */
  it("нулевые координаты — пропуск, а не точка у берегов Африки", () => {
    const f = pvzFeatures([пункт("1", 55.75, 37.62), пункт("2", 0, 0)]);
    expect(f.map((x) => x.id)).toEqual(["1"]);
  });

  it("координаты в порядке широта-долгота, как ждёт API", () => {
    const [f] = pvzFeatures([пункт("1", 55.75, 37.62)]);
    expect(f.geometry.coordinates).toEqual([55.75, 37.62]);
  });

  it("в подписи — адрес, по которому человек и искал", () => {
    const [f] = pvzFeatures([пункт("1", 55.75, 37.62)]);
    expect(f.properties.balloonContentBody).toBe("Адрес 1");
    expect(f.properties.balloonContentHeader).toBe("MSK1");
  });

  it("пункт без адреса не роняет разбор", () => {
    const без: CdekPickupPoint = { id: "9", name: "MSK9", latitude: 55, longitude: 37 };
    expect(pvzFeatures([без])[0].properties.balloonContentBody).toBe("");
  });
});

describe("рамка карты", () => {
  it("охватывает все точки", () => {
    expect(
      pvzBounds([пункт("1", 55.7, 37.5), пункт("2", 55.9, 37.8), пункт("3", 55.8, 37.6)]),
    ).toEqual([
      [55.7, 37.5],
      [55.9, 37.8],
    ]);
  });

  it("нулевые координаты рамку не растягивают", () => {
    expect(pvzBounds([пункт("1", 55.7, 37.5), пункт("2", 0, 0)])).toEqual([
      [55.7, 37.5],
      [55.7, 37.5],
    ]);
  });

  it("показывать нечего — рамки нет", () => {
    // Пустая карта города вместо списка ничего не сообщает, а место занимает.
    expect(pvzBounds([])).toBeNull();
    expect(pvzBounds([пункт("1", null, null)])).toBeNull();
  });
});
