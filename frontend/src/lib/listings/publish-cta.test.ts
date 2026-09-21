import { describe, expect, it } from "vitest";
import { publishCta } from "@/lib/listings/publish-cta";

const платно = { is_free: false, final_cents: 100 };
const бесплатно = { is_free: true, final_cents: 0 };
const готово = { paymentEnabled: true, flagsHydrated: true, quoteLoading: false };

describe("подпись главной кнопки формы объявления", () => {
  it("правка опубликованного — сохранение, не публикация", () => {
    expect(publishCta({ ...готово, editing: true, editingDraft: false, quote: платно })).toEqual({
      key: "saveChanges",
    });
  });

  it("правка черновика в платной категории ведёт к оплате", () => {
    // Ради этого случая всё и затевалось: до 21.09 здесь безусловно стояло
    // «Сохранить изменения», и черновик в платной категории не публиковался
    // ничем — ни из списка, ни из формы.
    expect(publishCta({ ...готово, editing: true, editingDraft: true, quote: платно })).toEqual({
      key: "payAndPublish",
      priceCents: 100,
    });
  });

  it("правка черновика в бесплатной категории публикует без оплаты", () => {
    expect(publishCta({ ...готово, editing: true, editingDraft: true, quote: бесплатно })).toEqual({
      key: "publishFree",
    });
  });

  it("создание в платной категории ведёт к оплате", () => {
    expect(publishCta({ ...готово, editing: false, editingDraft: false, quote: платно })).toEqual({
      key: "payAndPublish",
      priceCents: 100,
    });
  });

  it("цена берётся из котировки, а не из общей настройки", () => {
    // 20.09 форма правки обещала 30 ₽ в категории за 1 ₽ и те же 30 ₽ в
    // категории за 500: котировку в правке не запрашивали вовсе, и подпись
    // падала на значение из настройки.
    const дорого = publishCta({
      ...готово,
      editing: true,
      editingDraft: true,
      quote: { is_free: false, final_cents: 50000 },
    });
    expect(дорого).toEqual({ key: "payAndPublish", priceCents: 50000 });
  });

  describe("пока данных нет, про деньги не утверждаем ничего", () => {
    it("флаги не приехали", () => {
      expect(
        publishCta({
          ...готово,
          flagsHydrated: false,
          editing: true,
          editingDraft: true,
          quote: платно,
        }),
      ).toEqual({ key: "calculating" });
    });

    it("котировка считается", () => {
      expect(
        publishCta({
          ...готово,
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
          ...готово,
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
        ...готово,
        paymentEnabled: false,
        editing: true,
        editingDraft: true,
        quote: платно,
      }),
    ).toEqual({ key: "publish" });
  });
});
