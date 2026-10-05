import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PAGE_TITLES, pageTitleKey } from "./page-titles";
import { ru } from "@/lib/i18n/locales/ru";

/**
 * Скрытый заголовок ставится ровно там, где своего нет.
 *
 * Две ошибки, от которых это сторожит, и обе тихие.
 *
 * Первая — заголовок удвоится: страница заводит себе видимый `<h1>`, а
 * таблица продолжает подставлять скрытый. На экране не видно ничего, при
 * чтении с экрана — два разных заголовка подряд.
 *
 * Вторая — ключа перевода нет, и `t()` отдаёт сам ключ: заголовок страницы
 * вслух читается как `nav.feed`. Тоже невидимо глазами.
 *
 * Маршрут → файл сопоставлен здесь явно: имена файлов маршрутов — это
 * соглашение, и если оно разойдётся с таблицей, проверка скажет об этом
 * вслух, а не пройдёт ни на чём.
 */
const МАРШРУТЫ = join(import.meta.dirname ?? __dirname, "..", "..", "routes");

const ФАЙЛЫ: Record<string, string> = {
  "/feed": "feed.tsx",
  "/messenger": "messenger.tsx",
  "/reviews": "reviews.index.tsx",
  "/channels/new": "channels.new.tsx",
};

/*
 * Страницы, у которых заголовок есть, но гость его не видит: вместо
 * содержимого там заслон входа. Замер гостем 04.10 показал их без `<h1>`,
 * и первая редакция таблицы включила их по ошибке — проверка ниже это
 * поймала. Держим список явно: если у одной из них заголовок пропадёт,
 * строка станет неверной молча.
 */
const СО_СВОИМ_ЗАГОЛОВКОМ: Record<string, string> = {
  // Заголовок рисует ProfileView, а не сам файл маршрута.
  "/profile": "../components/profile/ProfileView.tsx",
  // Заголовок стоит в самой странице: таблица по адресу его сюда поставить
  // не может — у дочерних страниц настроек совпадение маршрута равно
  // родительскому `/settings`, и у /settings/wallet выходило два заголовка.
  "/settings": "settings.tsx",
  "/friends": "friends.tsx",
  "/deals": "deals.index.tsx",
  "/reviews/upload": "reviews.upload.tsx",
  "/communities/new": "communities.new.tsx",
};

function значениеПоКлючу(ключ: string): unknown {
  return ключ.split(".").reduce<unknown>((узел, часть) => {
    if (узел && typeof узел === "object" && часть in узел) {
      return (узел as Record<string, unknown>)[часть];
    }
    return undefined;
  }, ru);
}

describe("скрытый заголовок страницы", () => {
  it("таблица не пуста и адреса в ней разобраны", () => {
    expect(PAGE_TITLES.length).toBeGreaterThanOrEqual(4);
    for (const [адрес] of Object.entries(ФАЙЛЫ)) {
      expect(pageTitleKey(адрес)).not.toBeNull();
    }
  });

  it("у каждого адреса из таблицы есть свой файл маршрута", () => {
    const пропавшие = Object.entries(ФАЙЛЫ)
      .filter(([, файл]) => !existsSync(join(МАРШРУТЫ, файл)))
      .map(([адрес, файл]) => `${адрес} → ${файл}`);
    expect(пропавшие).toEqual([]);
  });

  it("ни одна из этих страниц не рисует свой видимый h1", () => {
    const сВидимым = Object.entries(ФАЙЛЫ)
      .filter(([, файл]) => /<h1[\s>]/.test(readFileSync(join(МАРШРУТЫ, файл), "utf8")))
      .map(([адрес]) => адрес);
    expect(сВидимым).toEqual([]);
  });

  it("каждый ключ перевода существует и это строка", () => {
    const битые = PAGE_TITLES.map(([, ключ]) => ключ).filter(
      (ключ) => typeof значениеПоКлючу(ключ) !== "string",
    );
    expect(битые).toEqual([]);
  });

  it("у страниц со своим заголовком он действительно есть в исходнике", () => {
    const безЗаголовка = Object.entries(СО_СВОИМ_ЗАГОЛОВКОМ)
      .filter(([, файл]) => !/<h1[\s>]/.test(readFileSync(join(МАРШРУТЫ, файл), "utf8")))
      .map(([адрес]) => адрес);
    expect(безЗаголовка).toEqual([]);
  });

  it("страницы со своим заголовком скрытого не получают", () => {
    for (const адрес of Object.keys(СО_СВОИМ_ЗАГОЛОВКОМ)) {
      expect(pageTitleKey(адрес)).toBeNull();
    }
  });

  it("страницы со своим заголовком скрытого не получают", () => {
    expect(pageTitleKey("/ads")).toBeNull();
    expect(pageTitleKey("/login")).toBeNull();
    expect(pageTitleKey("/")).toBeNull();
  });
});

/**
 * Решение про заголовок принимается в одном месте.
 *
 * На стенде 04.10 вышло два `<h1>` на /messenger, /profile и /reviews:
 * скрытый от оболочки и свой от заслона входа. Два места, решавших про
 * заголовок одной страницы, разошлись — иначе и быть не могло.
 *
 * Теперь заслон спрашивает эту же таблицу. Проверка следит, что он её
 * действительно спрашивает, а не завёл своё правило.
 */
describe("уровень заголовка у заслона входа", () => {
  const источник = readFileSync(
    join(МАРШРУТЫ, "..", "components", "access", "GuestSectionStub.tsx"),
    "utf8",
  )
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ");

  it("берётся из общей таблицы, а не из своего условия", () => {
    expect(источник).toMatch(/pageTitleKey\(/);
    expect(источник).toMatch(/from "@\/lib\/layout\/page-titles"/);
  });

  it("жёстко заданного уровня в разметке не осталось", () => {
    expect(источник).not.toMatch(/headingLevel="h1"/);
    expect(источник).not.toMatch(/headingLevel="h2"/);
  });
});
