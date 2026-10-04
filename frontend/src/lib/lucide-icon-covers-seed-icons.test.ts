import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import * as lucide from "lucide-react";
import { describe, expect, it } from "vitest";

/**
 * Значки категорий из семян лежат в основном куске, а не тянут библиотеку.
 *
 * `lucide-icon.ts` держит выбранный список значков обычным импортом и
 * добирает остальные ленивым `import("lucide-react")` — 117 КБ по проводу.
 * Промах **одного** имени уводит страницу в этот хвост.
 *
 * Так уже было дважды. 07.09 — с `Boxes` (подставляемый дефолт категории без
 * своего значка). 04.10 — с `Coins`: категорию «Нумизматика» завели после той
 * починки. Замер на проде 04.10: кусок `lucide-react-*` грузился на `/feed`
 * и `/ads`, где этот значок встречается, и не грузился на `/`, `/login`,
 * `/how-to-use`, где его нет.
 *
 * Руками такой список не держится, и на экране регрессия не видна: значок
 * рисуется, просто за него привезли всю библиотеку. Поэтому проверка, а не
 * ещё одна строка в докблоке.
 *
 * Имена, заведённые прямо в базе через админку, отсюда недостижимы — эта
 * проверка закрывает только семена.
 */
const КОРЕНЬ = join(import.meta.dirname ?? __dirname, "..", "..", "..");
const СЕМЕНА = join(КОРЕНЬ, "backend", "database", "seeders");

/** Та же нормализация, что в `lucide-icon.ts`: `plane` → `Plane`. */
function вПascalCase(имя: string): string {
  if (/[-_]/.test(имя)) {
    return имя
      .split(/[-_]+/)
      .filter(Boolean)
      .map((ч) => ч.charAt(0).toUpperCase() + ч.slice(1).toLowerCase())
      .join("");
  }
  const тело = имя === имя.toUpperCase() ? имя.toLowerCase() : имя;
  const норм = /[A-Z]/.test(тело.slice(1)) ? тело : тело.toLowerCase();
  return норм.charAt(0).toUpperCase() + норм.slice(1);
}

function именаИзСемян(): string[] {
  const найдено = new Set<string>();
  for (const файл of readdirSync(СЕМЕНА)) {
    if (!файл.endsWith(".php")) continue;
    const текст = readFileSync(join(СЕМЕНА, файл), "utf8");
    for (const m of текст.matchAll(/'icon'\s*=>\s*'([A-Za-z][A-Za-z0-9_-]*)'/g)) {
      найдено.add(m[1]);
    }
  }
  return [...найдено].sort();
}

function статическийСписок(): Set<string> {
  const текст = readFileSync(join(__dirname, "lucide-icon.ts"), "utf8");
  const m = /import\s*\{([^}]*)\}\s*from\s*["']lucide-react["']/.exec(текст);
  if (!m) throw new Error("не нашёл импорт из lucide-react в lucide-icon.ts");
  return new Set(
    m[1]
      .split(",")
      .map((ч) => ч.trim().split(" as ")[0].trim())
      .filter((ч) => ч.length > 0 && !ч.startsWith("type ")),
  );
}

function дефолтыСлотов(): string[] {
  const текст = readFileSync(join(__dirname, "icon-slots.ts"), "utf8");
  return [
    ...new Set([...текст.matchAll(/defaultLucide:\s*"([A-Za-z0-9]+)"/g)].map((m) => m[1])),
  ].sort();
}

describe("значки категорий из семян не тянут библиотеку", () => {
  const имена = именаИзСемян();
  const статика = статическийСписок();

  it("семена вообще найдены — иначе проверка проходит ни на чём", () => {
    expect(имена.length).toBeGreaterThan(0);
    expect(статика.size).toBeGreaterThan(20);
    expect(дефолтыСлотов().length).toBeGreaterThan(10);
  });

  /*
   * Докблок `lucide-icon.ts` обещает, что здесь лежит каждый `defaultLucide`
   * из таблицы слотов. Обещание разошлось со списком молча: `CircleHelp`
   * (слот «Как пользоваться») в таблице был, в списке — нет, и навигация
   * приложения привозила за ним 117 КБ на /feed и /ads. Проверка переводит
   * обещание из докблока в то, что краснеет.
   */
  it("каждый дефолт таблицы слотов лежит в основном куске", () => {
    const промахи = дефолтыСлотов().filter((и) => !статика.has(и));
    expect(промахи).toEqual([]);
  });

  it("каждое имя, которое есть в lucide, лежит в основном куске", () => {
    const промахи = имена
      .map((и) => ({ имя: и, компонент: вПascalCase(и) }))
      .filter(({ компонент }) => компонент in lucide && !статика.has(компонент));
    expect(промахи).toEqual([]);
  });

  /*
   * `tank` в lucide не существует вовсе: такое имя добирает список имён
   * (6,8 КБ) и остаётся на заглушке `Box`. В боевой базе 04.10 его нет —
   * только в семенах, то есть изъян скрытый, а не живой.
   *
   * Список здесь, а не молчание: новое несуществующее имя должно краснеть.
   * Починка `tank` тоже покраснит — тогда уберите его отсюда.
   */
  it("несуществующих имён ровно столько, сколько известно", () => {
    const нетВLucide = имена.filter((и) => !(вПascalCase(и) in lucide));
    expect(нетВLucide).toEqual(["tank"]);
  });
});
