import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Отказ оплаты доходит до человека на экране покупки.
 *
 * Оба обработчика на `/subscription` стояли как `catch {` без переменной и
 * заменяли любую причину на «Не удалось создать платёж. Попробуйте позже.» —
 * то есть советовали повторить то, что не изменится, пока платёжный контур не
 * настроят.
 *
 * Найдено ревью 03.10: бэкенд уже отвечал 503 с внятным текстом, проверка на
 * `formatApiErrorMessage` была зелёная, а на самом экране покупки текст
 * терялся. Проверка помощника без проверки вызывающего ничего не стоит.
 */
const экран = () => readFileSync(join(import.meta.dirname, "subscription.tsx"), "utf8");

describe("экран подписки показывает причину отказа", () => {
  it("ошибка не проглатывается", () => {
    expect(экран(), "`catch {` без переменной теряет причину отказа").not.toContain(
      '} catch {\n    toast.error(i18n.t("pages.subscription.payCreateFailed"));',
    );
  });

  it("причина проходит через общий разбор ошибок", () => {
    const текст = экран();
    const вхождений =
      текст.split('formatApiErrorMessage(err, i18n.t("pages.subscription.payCreateFailed"))')
        .length - 1;
    expect(вхождений, "ожидались оба места: подписка и разовое размещение").toBe(2);
  });
});
