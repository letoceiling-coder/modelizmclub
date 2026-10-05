import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Состав нижней панели на телефоне.
 *
 * Решение D4: пять пунктов — Лента, Сообщества, Сообщения, Объявления,
 * Профиль, — а «Друзья» живут в профиле и меню. Шестым пунктом панели они
 * стояли до 05.10.
 *
 * Проверка читает исходник, а не отрисовку: состав задан массивом, и
 * ломается он добавленной строкой, а не разметкой. Тот же приём, что в
 * `sidebar-community-order.test.ts`.
 */
const BOTTOM_NAV = join(import.meta.dirname, "BottomNav.tsx");
const USER_MENU = join(import.meta.dirname, "UserMenu.tsx");

function разделыПанели(): string[] {
  const источник = readFileSync(BOTTOM_NAV, "utf8");
  const начало = источник.indexOf("const ALL_ITEMS: Item[] = [");
  expect(начало, "массив ALL_ITEMS не найден — проверка смотрит не туда").toBeGreaterThan(-1);
  const конец = источник.indexOf("\n];", начало);
  const блок = источник.slice(начало, конец);

  return [...блок.matchAll(/section: "([a-z-]+)"/g)].map((m) => m[1]);
}

describe("нижняя панель на телефоне", () => {
  it("ровно пять пунктов в порядке D4", () => {
    expect(разделыПанели()).toEqual(["feed", "communities", "messenger", "ads", "profile"]);
  });

  it("«Друзей» в панели нет", () => {
    expect(разделыПанели()).not.toContain("friends");
  });

  it("у каждого пункта есть слот значка", async () => {
    const { ICON_SLOTS } = await import("@/lib/icon-slots");
    const ключи = new Set(ICON_SLOTS.map((s) => s.key));
    const без = разделыПанели().filter((s) => !ключи.has(`nav.${s}`));

    expect(без).toEqual([]);
  });
});

/**
 * Вторая половина D4, без которой первая отнимает доступ.
 *
 * Проверено в браузере 05.10: меню аватара (`UserMenu`) живёт в
 * `DesktopTopBar` под `hidden lg:block` — при 360px кнопка аватара
 * `display: none`, то есть на телефоне этого меню нет вовсе. Боковая
 * колонка — от 768px (`Sidebar`: `md:flex`). Единственное меню телефона —
 * бургер `MoreMenu`, и он строится из `MOBILE_MENU_SECTIONS`.
 *
 * Поэтому «Друзья» обязаны быть в реестре мобильного меню, а не только в
 * меню аватара. Утверждения ниже держатся вместе: уберите любое — упадёт
 * тест, а не доступ у человека на телефоне.
 */
describe("«Друзья» после переноса из панели", () => {
  it("вкладок панели ровно пять и друзей среди них нет", async () => {
    const { PRIMARY_TAB_ROUTES } = await import("@/lib/nav");
    const { ROUTES } = await import("@/lib/routes");

    expect(PRIMARY_TAB_ROUTES).toHaveLength(5);
    expect(PRIMARY_TAB_ROUTES).not.toContain(ROUTES.friends);
  });

  it("есть в мобильном меню — единственном, что видно на телефоне", async () => {
    const { MOBILE_MENU_SECTIONS } = await import("@/lib/nav");

    expect(MOBILE_MENU_SECTIONS.map((s) => s.key)).toContain("friends");
  });

  it("раздел остаётся достижимым на телефоне", async () => {
    const { assertMobileNavCoverage } = await import("@/lib/nav");
    const warnings: unknown[][] = [];
    const было = console.warn;
    console.warn = (...args: unknown[]) => void warnings.push(args);
    try {
      assertMobileNavCoverage();
    } finally {
      console.warn = было;
    }

    expect(warnings).toEqual([]);
  });

  it("есть пунктом и в меню аватара — для 1024px и шире", () => {
    const источник = readFileSync(USER_MENU, "utf8");

    expect(источник).toContain("ROUTES.friends");
    expect(источник).toContain('slot="nav.friends"');
  });

  it("счётчик заявок не потерялся вместе с пунктом", () => {
    const источник = readFileSync(USER_MENU, "utf8");

    expect(источник).toContain("useIncomingFriendRequestCount");
  });
});
