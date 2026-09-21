import { describe, expect, it } from "vitest";
import { publishCta, type PublishCta } from "@/lib/listings/publish-cta";
import { ru } from "@/lib/i18n/locales/ru";

const paid = { is_free: false, final_cents: 100 };
const free = { is_free: true, final_cents: 0 };
const ready = { paymentEnabled: true, flagsHydrated: true, quoteLoading: false };

describe("подпись главной кнопки формы объявления", () => {
  it("правка опубликованного — сохранение, не публикация", () => {
    expect(publishCta({ ...ready, editing: true, editingDraft: false, quote: paid })).toEqual({
      key: "saveChanges",
    });
  });

  it("правка черновика в платной категории ведёт к оплате", () => {
    // Ради этого случая всё и затевалось: до 21.09 здесь безусловно стояло
    // «Сохранить изменения», и черновик в платной категории не публиковался
    // ничем — ни из списка, ни из формы.
    expect(publishCta({ ...ready, editing: true, editingDraft: true, quote: paid })).toEqual({
      key: "payAndPublish",
      priceCents: 100,
    });
  });

  it("правка черновика в бесплатной категории публикует без оплаты", () => {
    expect(publishCta({ ...ready, editing: true, editingDraft: true, quote: free })).toEqual({
      key: "publishFree",
    });
  });

  it("создание в платной категории ведёт к оплате", () => {
    expect(publishCta({ ...ready, editing: false, editingDraft: false, quote: paid })).toEqual({
      key: "payAndPublish",
      priceCents: 100,
    });
  });

  it("цена берётся из котировки, а не из общей настройки", () => {
    // 20.09 форма правки обещала 30 ₽ в категории за 1 ₽ и те же 30 ₽ в
    // категории за 500: котировку в правке не запрашивали вовсе, и подпись
    // падала на значение из настройки.
    expect(
      publishCta({
        ...ready,
        editing: true,
        editingDraft: true,
        quote: { is_free: false, final_cents: 50000 },
      }),
    ).toEqual({ key: "payAndPublish", priceCents: 50000 });
  });

  describe("пока данных нет, про деньги не утверждаем ничего", () => {
    it("флаги не приехали", () => {
      expect(
        publishCta({
          ...ready,
          flagsHydrated: false,
          editing: true,
          editingDraft: true,
          quote: paid,
        }),
      ).toEqual({ key: "calculating" });
    });

    it("котировка считается", () => {
      expect(
        publishCta({
          ...ready,
          quoteLoading: true,
          editing: false,
          editingDraft: false,
          quote: null,
        }),
      ).toEqual({ key: "calculating" });
    });

    it("но правка опубликованного ждать не должна — ей котировка не нужна", () => {
      expect(
        publishCta({
          ...ready,
          flagsHydrated: false,
          quoteLoading: true,
          editing: true,
          editingDraft: false,
          quote: null,
        }),
      ).toEqual({ key: "saveChanges" });
    });
  });

  it("оплата выключена — публикуем без разговоров о цене", () => {
    expect(
      publishCta({
        ...ready,
        paymentEnabled: false,
        editing: true,
        editingDraft: true,
        quote: paid,
      }),
    ).toEqual({ key: "publish" });
  });
});

describe("каждому исходу есть перевод", () => {
  /*
   * Маршрут собирает ключ строкой — `t(`pages.adsNew.${cta.key}`)`, — и
   * опечатку в нём не поймает ни tsc, ни поиск по литералу: на экране
   * появится сама строка «pages.adsNew.publishFre», непустая, и проверки на
   * непустую подпись останутся зелёными.
   */
  const keys: PublishCta["key"][] = [
    "saveChanges",
    "calculating",
    "publish",
    "publishFree",
    "payAndPublish",
  ];

  it.each(keys)("%s", (key) => {
    const strings = ru.pages.adsNew as Record<string, unknown>;
    expect(strings).toHaveProperty(key);
    expect(typeof strings[key]).toBe("string");
  });
});
