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
