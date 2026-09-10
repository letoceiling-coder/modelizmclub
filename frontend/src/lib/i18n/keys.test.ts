import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { ru } from "./locales/ru";
import { ruAdmin } from "./locales/ru-admin";

/**
 * Каждый ключ, который просит код, есть в словаре.
 *
 * 10.09 на `/my-ads` вкладка называлась `pages.myAds.tabSold` — точечным
 * путём вместо слова. Три ключа при правке словаря попали в соседнюю секцию:
 * скрипт вставки встал по первому совпадению якоря, а якорь был в двух
 * местах. Ни tsc, ни eslint, ни тесты этого не видели — i18next на
 * ненайденный ключ не падает, а возвращает сам ключ, и дефект дожил до прода
 * и нашёлся только глазами, в аудите, на ширине 768.
 *
 * Поэтому проверка отдельная: она читает вызовы `t("…")` из исходников и
 * сверяет каждый путь со словарём. Дырка закрывается воротами, а не
 * внимательностью.
 */
const SRC = join(import.meta.dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) {
      walk(full, out);
    } else if (/\.tsx?$/.test(name) && !/\.test\.tsx?$/.test(name)) {
      out.push(full);
    }
  }
  return out;
}

function lookup(dict: unknown, path: string): unknown {
  let node: unknown = dict;
  for (const part of path.split(".")) {
    if (node === null || typeof node !== "object") return undefined;
    node = (node as Record<string, unknown>)[part];
    if (node === undefined) return undefined;
  }
  return node;
}

/**
 * Ключ с числом живёт в словаре под суффиксами формы: i18next выбирает
 * `_one` / `_few` / `_many` по `Intl.PluralRules`, а голого пути в словаре
 * при этом нет вовсе. Без этой поправки проверка ругалась бы на каждый
 * счётчик.
 */
const PLURAL = ["_one", "_few", "_many", "_other", "_zero"];

function has(dict: unknown, path: string): boolean {
  const direct = lookup(dict, path);
  if (typeof direct === "string" || (direct !== null && typeof direct === "object")) return true;

  return PLURAL.some((suffix) => typeof lookup(dict, path + suffix) === "string");
}

/**
 * Разбор вызова: аргументы, разрезанные по запятым верхнего уровня.
 *
 * Считать регулярным выражением нельзя: внутри значений встречаются свои
 * скобки, строки и шаблоны. 10.09 на этом и вышла осечка — выражение,
 * ловившее «объект целиком», закрывалось на первой внутренней скобке, и
 * половина переданных имён терялась. Поэтому один проход со счётчиком
 * глубины и пропуском строковых литералов.
 */
function splitArgs(text: string, paren: number): string[] {
  const parts: string[] = [];
  let depth = 0;
  let cur = "";
  let i = paren;

  while (i < text.length) {
    const c = text[i];

    if (c === '"' || c === "'" || c === "`") {
      let j = i + 1;
      while (j < text.length && text[j] !== c) j += text[j] === "\\" ? 2 : 1;
      cur += text.slice(i, j + 1);
      i = j + 1;
      continue;
    }

    if (c === "(" || c === "[" || c === "{") {
      depth += 1;
      if (depth === 1) {
        i += 1;
        continue;
      }
    } else if (c === ")" || c === "]" || c === "}") {
      depth -= 1;
      if (depth === 0) {
        parts.push(cur);
        return parts;
      }
    }

    if (depth === 1 && c === ",") {
      parts.push(cur);
      cur = "";
    } else {
      cur += c;
    }
    i += 1;
  }

  parts.push(cur);
  return parts;
}

/**
 * Имена, переданные объектом параметров.
 *
 * `null` — разобрать нельзя: это не объектный литерал или в нём есть
 * расстановка (`...vars`), содержимое которой статически неизвестно. Такие
 * вызовы проверка пропускает, а не считает дефектными: соврать «не передал»
 * хуже, чем промолчать.
 */
function optionNames(src: string): Set<string> | null {
  const body = src.trim();
  if (!body.startsWith("{")) return null;

  const parts = splitArgs(body, 0);
  if (parts.some((p) => p.includes("..."))) return null;

  const names = new Set<string>();
  for (const raw of parts) {
    const p = raw.replace(/\/\/[^\n]*/g, "").trim();
    if (!p) continue;
    // `name: значение` и сокращённая запись `{ name }` — обе формы.
    const m = /^([A-Za-z_]\w*)\s*:/.exec(p) ?? /^([A-Za-z_]\w*)$/.exec(p);
    if (m) names.add(m[1]);
  }
  return names;
}

/** Подстановки `{{x}}` во всех формах ключа. */
function placeholdersOf(key: string): Set<string> {
  const values: string[] = [];
  const direct = lookup(ru, key) ?? lookup(ruAdmin, key);
  if (typeof direct === "string") {
    values.push(direct);
  } else {
    for (const suffix of PLURAL) {
      const v = lookup(ru, key + suffix) ?? lookup(ruAdmin, key + suffix);
      if (typeof v === "string") values.push(v);
    }
  }

  const out = new Set<string>();
  for (const v of values) {
    for (const m of v.matchAll(/\{\{(\w+)\}\}/g)) out.add(m[1]);
  }
  return out;
}

describe("ключи переводов", () => {
  it('каждый статический t("…") находится в словаре', () => {
    // Только строковые литералы: вычисляемые ключи (`t(\`a.${x}\`)`) проверить
    // статически нельзя, и притворяться, что можно, хуже, чем их пропустить.
    /*
     * Второй аргумент решает, дефект это или нет. `t("k", "Текст")` и
     * `t("k", { defaultValue: … })` показывают запасную подпись, а не
     * точечный путь, — такие вызовы пропускаем: они некрасивы, но человек
     * видит слова. Ругаемся только там, где запасного текста нет.
     *
     * Разбор идёт по окну исходника после ключа, а не выражением над
     * скобками: у `reviews.$id.tsx` объект параметров содержит вложенный
     * шаблон со своими фигурными скобками, и любое регулярное выражение,
     * пытающееся поймать «объект целиком», закрывается на внутренней скобке
     * раньше, чем доходит до `defaultValue`.
     */
    const call = /\bt\(\s*"([a-zA-Z][\w.]*\.[\w.]+)"/g;
    const missing: string[] = [];

    for (const file of walk(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(call)) {
        const key = m[1];
        const after = text.slice(m.index + m[0].length, m.index + m[0].length + 400);
        const window = after.split(/\bt\(/)[0];
        const hasFallback = /^\s*,\s*"/.test(after) || window.includes("defaultValue");
        if (hasFallback) continue;
        if (!has(ru, key) && !has(ruAdmin, key)) {
          missing.push(`${file.slice(SRC.length + 1)} → ${key}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("проверка не выродилась: ключей найдено больше двухсот", () => {
    // Иначе сломанное регулярное выражение давало бы пустой список и вечно
    // зелёный тест.
    const call = /\bt\(\s*"([a-zA-Z][\w.]*\.[\w.]+)"/g;
    let found = 0;
    for (const file of walk(SRC)) {
      found += [...readFileSync(file, "utf8").matchAll(call)].length;
    }
    expect(found).toBeGreaterThan(200);
  });
  /*
   * Подстановки.
   *
   * Наличия ключа мало. 10.09 на всех пятнадцати страницах направлений
   * стояло «· {{formatted}} участников»: ключ перевели на два значения —
   * `count` выбирает форму, `formatted` печатается, — а два места вызова
   * из десяти остались со старым набором аргументов. Ключ на месте, тест
   * зелёный, на экране фигурные скобки.
   *
   * i18next на недостающую подстановку не падает и не подставляет пустоту:
   * он оставляет `{{имя}}` как есть, и это видно человеку.
   */
  it("каждый вызов передаёт все подстановки своей строки", () => {
    const missing: string[] = [];

    for (const file of walk(SRC)) {
      const text = readFileSync(file, "utf8");
      for (const m of text.matchAll(/\bt\(\s*"([a-zA-Z][\w.]*\.[\w.]+)"/g)) {
        const key = m[1];
        const required = placeholdersOf(key);
        if (required.size === 0) continue;

        const args = splitArgs(text, text.indexOf("(", m.index));
        const passed = args.length < 2 ? new Set<string>() : optionNames(args[1]);
        if (passed === null) continue;

        const gaps = [...required].filter((name) => !passed.has(name));
        if (gaps.length > 0) {
          missing.push(`${file.slice(SRC.length + 1)} → ${key}: не передано ${gaps.join(", ")}`);
        }
      }
    }

    expect(missing).toEqual([]);
  });

  it("проверка подстановок не выродилась: строк с {{…}} больше сотни", () => {
    // Иначе пустой словарь давал бы вечно зелёный тест.
    let withPlaceholders = 0;
    const countIn = (node: unknown): void => {
      if (typeof node === "string") {
        if (node.includes("{{")) withPlaceholders += 1;
        return;
      }
      if (node && typeof node === "object") Object.values(node).forEach(countIn);
    };
    countIn(ru);
    countIn(ruAdmin);
    expect(withPlaceholders).toBeGreaterThan(100);
  });
});
