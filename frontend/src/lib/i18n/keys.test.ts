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
});
