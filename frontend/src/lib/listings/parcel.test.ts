import { describe, expect, it } from "vitest";
import {
  parcelFieldErrors,
  parcelFromForm,
  parcelMissing,
  parcelSummary,
  type ParcelForm,
} from "@/lib/listings/parcel";

const пусто: ParcelForm = {
  deliveries: [],
  weightKg: "",
  dimL: "",
  dimW: "",
  dimH: "",
  pickupAddress: "",
};
const сдэк = (over: Partial<ParcelForm> = {}): ParcelForm => ({
  ...пусто,
  deliveries: ["СДЭК"],
  dimL: "30",
  dimW: "20",
  dimH: "15",
  weightKg: "2",
  ...over,
});

describe("чего не хватает посылке", () => {
  it("всё заполнено — отправлять можно", () => {
    expect(parcelMissing(сдэк())).toBeNull();
  });

  /*
   * Ради этого случая проверка и написана. До 22.09 на все четыре поля была
   * одна строка про типоразмер S/M/L: на форме с тремя заполненными полями
   * она не говорила человеку, какое поле осталось, — и он видел кнопку,
   * которая просто ничего не делает.
   */
  it("названо ровно недостающее", () => {
    expect(parcelMissing(сдэк({ weightKg: "" }))).toBe("Для СДЭК укажите вес посылки.");
    expect(parcelMissing(сдэк({ dimW: "" }))).toBe("Для СДЭК укажите ширину посылки.");
  });

  it("не заполнено ничего — перечислены все четыре", () => {
    const m = parcelMissing({ ...пусто, deliveries: ["СДЭК"] });
    for (const поле of ["длину", "ширину", "высоту", "вес"]) {
      expect(m).toContain(поле);
    }
  });

  it("без СДЭК габариты не спрашиваются", () => {
    // Почтой продавец отправляет сам, и коробку площадка не оплачивает.
    expect(parcelMissing({ ...пусто, deliveries: ["Почта России"] })).toBeNull();
  });

  it("самовывоз требует адрес", () => {
    expect(parcelMissing({ ...пусто, deliveries: ["Самовывоз"] })).toBe(
      "Укажите адрес или ориентир для самовывоза.",
    );
    expect(
      parcelMissing({ ...пусто, deliveries: ["Самовывоз"], pickupAddress: "ул. Ленина, 1" }),
    ).toBeNull();
  });

  it("ноль — не значение", () => {
    // `Number("0") > 0` ложно, но «0» в поле выглядит заполненным.
    expect(parcelMissing(сдэк({ dimH: "0" }))).toBe("Для СДЭК укажите высоту посылки.");
  });
});

describe("что уходит на сервер", () => {
  it("измеренное едет как есть", () => {
    expect(parcelFromForm(сдэк())).toEqual({
      weightKg: 2,
      dimensionsCm: { length: 30, width: 20, height: 15 },
      pickupAddress: undefined,
    });
  });

  it("вес через запятую — это не ошибка ввода, а привычка", () => {
    expect(parcelFromForm(сдэк({ weightKg: "1,5" })).weightKg).toBe(1.5);
  });

  it("без СДЭК габариты не отправляются", () => {
    /*
     * Иначе в объявлении осталась бы коробка, которой продавец на форме уже
     * не видит: поля скрыты вместе со снятой отметкой СДЭК.
     */
    const снят = parcelFromForm({ ...сдэк(), deliveries: ["Почта России"] });
    expect(снят.dimensionsCm).toBeUndefined();
    expect(снят.weightKg).toBeUndefined();
  });

  it("неполные измерения не отправляются по частям", () => {
    expect(parcelFromForm(сдэк({ weightKg: "" })).dimensionsCm).toBeUndefined();
  });
});

describe("строка о том, по чему посчитается тариф", () => {
  it("называет размеры продавца", () => {
    expect(parcelSummary(сдэк())).toBe("Тариф посчитаем по вашим размерам: 30×20×15 см, 2 кг.");
  });

  it("без данных не обещает придуманную коробку", () => {
    // До 22.09 здесь предлагался типоразмер — то есть размеры, которых
    // продавец не мерил, а разницу с настоящей коробкой доплачивала площадка.
    const s = parcelSummary({ ...пусто, deliveries: ["СДЭК"] });
    expect(s).toBe("Укажите все четыре значения — иначе тариф не посчитать.");
    expect(s).not.toMatch(/типоразмер/i);
  });
});

describe("ошибка стоит у своего поля", () => {
  it("всё заполнено — ошибок нет", () => {
    expect(parcelFieldErrors(сдэк())).toEqual({});
  });

  /*
   * Ради этого случая разбор и завёлся. Одна строка под блоком не говорит,
   * какое из четырёх полей пустое, а в режиме правки до тоста и вовсе не
   * доходят: кнопка там просто выключена.
   */
  it("пустое поле называет себя само", () => {
    expect(parcelFieldErrors(сдэк({ dimH: "" }))).toEqual({ dimH: "Укажите высоту посылки" });
  });

  it("верхний предел тот же, что на сервере", () => {
    // Без него 250 см проходили проверку формы и возвращались отказом
    // сервера по ключу `dimensions_cm.length`, которого форма не знает.
    expect(parcelFieldErrors(сдэк({ dimL: "250" }))).toEqual({ dimL: "Не больше 200 см" });
    expect(parcelFieldErrors(сдэк({ weightKg: "150" }))).toEqual({ weightKg: "Не больше 100 кг" });
  });

  it("без СДЭК полей нет и ошибок нет", () => {
    expect(parcelFieldErrors({ ...пусто, deliveries: ["Почта России"] })).toEqual({});
  });

  it("превышение попадает и в строку для тоста", () => {
    expect(parcelMissing(сдэк({ dimL: "250" }))).toContain("Не больше 200 см");
  });
});
