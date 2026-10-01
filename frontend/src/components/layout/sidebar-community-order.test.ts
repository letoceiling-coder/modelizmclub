import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Порядок пунктов раздела «Сообщество» в боковой колонке.
 *
 * «Как пользоваться» стояла первой — то есть каждый день отодвигала
 * ленту вниз ради страницы, которую читают один раз. Вход в справку
 * остаётся в верхней шапке; здесь она последняя.
 *
 * Проверка читает исходник, а не отрисовку: порядок задан массивом, и
 * ломается он перестановкой строк, а не разметкой.
 */
const SIDEBAR = join(import.meta.dirname, "Sidebar.tsx");

function communitySections(): string[] {
  const source = readFileSync(SIDEBAR, "utf8");
  const начало = source.indexOf("const COMMUNITY_ITEMS: Item[] = [");
  expect(начало, "массив COMMUNITY_ITEMS не найден — проверка смотрит не туда").toBeGreaterThan(-1);
  const конец = source.indexOf("\n];", начало);
  const блок = source.slice(начало, конец);

  return [...блок.matchAll(/section: "([a-z-]+)"/g)].map((m) => m[1]);
}

describe("боковая колонка, раздел «Сообщество»", () => {
  it("идёт лента, мессенджер, обзоры, сообщества, каналы, друзья, справка", () => {
    expect(communitySections()).toEqual([
      "feed",
      "messenger",
      "reviews",
      "communities",
      "channels",
      "friends",
      "how-to-use",
    ]);
  });

  it("справка — последняя, а не первая", () => {
    const порядок = communitySections();

    expect(порядок.at(-1)).toBe("how-to-use");
    expect(порядок[0]).toBe("feed");
  });
});

/**
 * У каждого пункта колонки есть свой значок и своя подсветка.
 *
 * У «Как пользоваться» не было ни того, ни другого: слот `nav.how-to-use`
 * в реестре отсутствовал — рисовался запасной значок-коробка, — а
 * `SIDEBAR_ROUTE_MAP` не знал пути, и на собственной странице пункт не
 * подсвечивался. Найдено ревью 01.10, пока пункт переезжал в конец.
 */
describe("пункты раздела «Сообщество»", () => {
  it("у каждого есть слот значка", async () => {
    const { ICON_SLOTS } = await import("@/lib/icon-slots");
    const ключи = new Set(ICON_SLOTS.map((s) => s.key));
    const без = communitySections().filter((s) => !ключи.has(`nav.${s}`));

    expect(без).toEqual([]);
  });

  it("каждый подсвечивается на своей странице", async () => {
    const { SIDEBAR_ROUTE_MAP } = await import("@/lib/routes");
    const без = communitySections().filter((s) => !SIDEBAR_ROUTE_MAP[s]);

    expect(без).toEqual([]);
  });
});
