import { describe, expect, it } from "vitest";

import { ru } from "./locales/ru";
import i18n, { LOCALE, loadAdminLocale } from "@/lib/i18n";

type Dict = Record<string, unknown>;

function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value as Dict).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

/**
 * Порядок проверок в этом файле значим: `loadAdminLocale()` домешивает
 * админские ключи в тот же словарь и обратно их не вынуть. Проверка «в общем
 * чанке админки нет» обязана идти до загрузки.
 */
describe("словарь", () => {
  it("зарегистрирован ровно один язык", () => {
    expect(Object.keys(i18n.options.resources ?? {})).toEqual([LOCALE]);
    expect(i18n.language).toBe("ru");
  });

  it("подписи настоящие, а не точечные пути", () => {
    expect(i18n.t("common.save")).toBe("Сохранить");
  });

  it("админские ключи не лежат в главном чанке", () => {
    const bundle = i18n.getResourceBundle("ru", "translation") as {
      pages?: Record<string, unknown>;
    };
    expect(bundle.pages?.adminShell).toBeUndefined();
  });

  it("админский словарь досылается по требованию", async () => {
    await loadAdminLocale();

    const bundle = i18n.getResourceBundle("ru", "translation") as {
      pages?: Record<string, unknown>;
    };
    expect(bundle.pages?.adminShell).toBeDefined();
    // Досылка не должна затирать уже загруженное.
    expect(i18n.t("common.save")).toBe("Сохранить");
  });

  /*
   * Без этой проверки сравнения выше проходили бы и на пустом объекте —
   * например если импорт однажды начнёт отдавать `undefined`.
   */
  it("проверка не выродилась: ключей больше тысячи", () => {
    expect(keyPaths(ru).length).toBeGreaterThan(1000);
  });
});
