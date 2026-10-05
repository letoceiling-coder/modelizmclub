import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Ни один раздел админки не выпадает из меню.
 *
 * 05.10 владелец сказал, что «много панелей пропало» и «нет редактирования
 * сайта». Проверка показала, что из кода не пропало ничего: все тридцать
 * разделов на месте и все в меню. Пропали они из поля зрения — тридцать
 * строк одним столбцом без заголовков, — и потому, что роль владельца на
 * проде была «модератор», а двадцать разделов из тридцати двух доступны
 * только владельцу.
 *
 * Группы чинят первое. Эта проверка сторожит второе: раздел, не попавший ни
 * в одну группу, исчезнет из меню молча — на экране просто станет одной
 * строкой меньше, и заметит это тот же разговор полгода спустя.
 *
 * Читаем исходник, а не импортируем модуль: `admin.lazy.tsx` тянет за собой
 * половину админки, и проверка превратилась бы в сборку.
 */
const ФАЙЛ = join(import.meta.dirname ?? __dirname, "admin.lazy.tsx");
const ТИПЫ = join(import.meta.dirname ?? __dirname, "admin.tsx");

function источник(путь: string): string {
  return readFileSync(путь, "utf8");
}

function пунктыМеню(): string[] {
  const блок = /const navItems[^[]*\[([\s\S]*?)\n\];/.exec(источник(ФАЙЛ));
  if (!блок) throw new Error("не нашёл navItems в admin.lazy.tsx");
  return [...блок[1].matchAll(/id:\s*"([a-zA-Z]+)"/g)].map((m) => m[1]);
}

function группы(): { id: string; items: string[] }[] {
  const блок = /NAV_GROUPS[^[]*\[([\s\S]*?)\n\];/.exec(источник(ФАЙЛ));
  if (!блок) throw new Error("не нашёл NAV_GROUPS в admin.lazy.tsx");
  return [...блок[1].matchAll(/id:\s*"([a-z]+)"[\s\S]*?items:\s*\[([\s\S]*?)\]/g)].map((m) => ({
    id: m[1],
    items: [...m[2].matchAll(/"([a-zA-Z]+)"/g)].map((x) => x[1]),
  }));
}

describe("группы меню админки", () => {
  const пункты = пунктыМеню();
  const гр = группы();
  const вГруппах = gr().flat();

  function gr(): string[][] {
    return гр.map((g) => g.items);
  }

  it("меню и группы вообще найдены — иначе проверка проходит ни на чём", () => {
    expect(пункты.length).toBeGreaterThan(20);
    expect(гр.length).toBeGreaterThanOrEqual(5);
  });

  it("каждый пункт меню лежит ровно в одной группе", () => {
    const без = пункты.filter((id) => !вГруппах.includes(id));
    expect(без).toEqual([]);

    const дважды = пункты.filter((id) => вГруппах.filter((x) => x === id).length > 1);
    expect(дважды).toEqual([]);
  });

  it("в группах нет пунктов, которых нет в меню", () => {
    const лишние = vГруппахУникальные().filter((id) => !пункты.includes(id));
    expect(лишние).toEqual([]);
  });

  function vГруппахУникальные(): string[] {
    return [...new Set(вГруппах)];
  }

  /*
   * Раздел объявлен в типе `Section`, но не попал в меню — он недостижим
   * иначе как прямой ссылкой. Два таких есть намеренно: `monetization` —
   * старый адрес, ведущий на «Тарифы и цены», и `reviewCategories` — вкладка
   * внутри «Обзоров». Список держим явно: третий такой должен покраснеть.
   */
  it("разделов вне меню ровно столько, сколько известно", () => {
    const объявлены = [...источник(ТИПЫ).matchAll(/^\s+\|\s*"([a-zA-Z]+)"/gm)].map((m) => m[1]);
    const внеМеню = объявлены.filter((id) => !пункты.includes(id));
    expect(внеМеню.sort()).toEqual(["monetization", "reviewCategories"]);
  });

  it("баннеры ленты и управление сайтом — в группе «Управление сайтом»", () => {
    const сайт = гр.find((g) => g.id === "site");
    expect(сайт).toBeDefined();
    for (const нужное of ["feedBanners", "landingBlocks", "settings", "design", "legalPages"]) {
      expect(сайт?.items).toContain(нужное);
    }
  });

  it("доступы людей — в группе «Люди и доступы»", () => {
    const люди = гр.find((g) => g.id === "people");
    expect(люди?.items).toContain("users");
    expect(люди?.items).toContain("roles");
    expect(люди?.items).toContain("feedGuestAccess");
  });
});
