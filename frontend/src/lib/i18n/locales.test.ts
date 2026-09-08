import { describe, expect, it } from "vitest";
import { ru } from "./locales/ru";
import { en } from "./locales/en";
import { zh } from "./locales/zh";
import { ruAdmin } from "./locales/ru-admin";
import { enAdmin } from "./locales/en-admin";
import { zhAdmin } from "./locales/zh-admin";

/**
 * Состав ключей во всех словарях одинаков.
 *
 * `TranslationSchema` — это `typeof ru`, то есть tsc и так ловит расхождение.
 * Ловит, но говорит о нём плохо: «Property 'consents' is missing in type
 * { … 237 more … }» — и следующие двести ключей молчат, потому что компилятор
 * сообщает про первое несоответствие в объекте. 08.09 разбор занял час: из
 * тридцати девяти ошибок двенадцать были про локали, а не хватало на самом
 * деле восьмидесяти одного ключа в английском и девяноста в китайском.
 *
 * Здесь расхождение печатается списком целиком. Тест не заменяет проверку
 * типов, а делает её читаемой.
 *
 * Админский словарь проверяется отдельно: он живёт своим файлом на каждый
 * язык и догружается только при открытии /admin.
 */
type Dict = Record<string, unknown>;

function keyPaths(value: unknown, prefix = ""): string[] {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return [prefix];
  }

  return Object.entries(value as Dict).flatMap(([key, child]) =>
    keyPaths(child, prefix ? `${prefix}.${key}` : key),
  );
}

function compare(reference: unknown, candidate: unknown) {
  const left = new Set(keyPaths(reference));
  const right = new Set(keyPaths(candidate));

  return {
    missing: [...left].filter((k) => !right.has(k)).sort(),
    extra: [...right].filter((k) => !left.has(k)).sort(),
  };
}

describe("состав ключей локалей", () => {
  it.each([
    ["en", en],
    ["zh", zh],
  ])("%s совпадает с ru", (_name, locale) => {
    const { missing, extra } = compare(ru, locale);

    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it.each([
    ["en-admin", enAdmin],
    ["zh-admin", zhAdmin],
  ])("%s совпадает с ru-admin", (_name, locale) => {
    const { missing, extra } = compare(ruAdmin, locale);

    expect(missing).toEqual([]);
    expect(extra).toEqual([]);
  });

  it("проверка не выродилась: ключей в справочнике больше тысячи", () => {
    // Без этого сравнение пустых объектов проходило бы молча — например если
    // импорт однажды начнёт отдавать `undefined`.
    expect(keyPaths(ru).length).toBeGreaterThan(1000);
    expect(keyPaths(ruAdmin).length).toBeGreaterThan(500);
  });
});
