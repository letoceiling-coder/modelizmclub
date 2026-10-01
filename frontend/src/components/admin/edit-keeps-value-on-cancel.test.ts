import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Отказ в окне правки не стирает правку.
 *
 * Правка направления — цепочка окон, и до 01.10 два из пяти вопросов
 * обрывали её молча: `(await askText(…))?.trim()` плюс `if (!name) return`
 * не отличали отказ от стёртого поля. Человек менял название, нажимал
 * «Отмена» на следующем вопросе — и правка исчезала без сообщения.
 * Запроса к серверу при этом не было вовсе, поэтому искать потерю в
 * контроллере было бессмысленно.
 *
 * Проверка смотрит только на функции правки: при создании отказ и должен
 * всё отменять — сохранять там нечего.
 *
 * Чего она не ловит — чтобы на неё не полагались шире, чем она умеет:
 * правку, написанную как `function edit…` или `useCallback`; запись
 * `if (!поле) { return; }` и `if (поле == null) return`; файлы во
 * вложенных каталогах `components/admin`. Границу блока она ищет по
 * закрывающей скобке на отступе в два пробела, то есть правка внутри
 * вложенного компонента ей не по зубам и может дать ложное
 * срабатывание. Это сторож известного отказа, а не доказательство
 * отсутствия всех прочих.
 */
const ADMIN = import.meta.dirname;

function editBlocks(source: string): string[] {
  const blocks: string[] = [];
  for (const match of source.matchAll(/const edit\w* = async[\s\S]*?\n {2}\};\n/g)) {
    blocks.push(match[0]);
  }

  return blocks;
}

describe("правка в админке", () => {
  it("не выбрасывает введённое при отказе в следующем окне", () => {
    const нарушения: string[] = [];
    let проверено = 0;

    for (const name of readdirSync(ADMIN)) {
      if (!name.endsWith(".tsx")) continue;
      const source = readFileSync(join(ADMIN, name), "utf8");
      if (!source.includes("askText")) continue;

      for (const block of editBlocks(source)) {
        проверено += 1;
        for (const m of block.matchAll(/(?:const|let)\s+(\w+)\s*=\s*\(?\s*await askText\(/g)) {
          const поле = m[1];
          const хвост = block.slice(m.index + m[0].length);
          if (new RegExp(`if\\s*\\(\\s*!\\s*${поле}\\s*\\)\\s*return`).test(хвост)) {
            нарушения.push(`${name}: if (!${поле}) return`);
          }
        }
      }
    }

    // Пустая выборка выглядела бы как успех — проверяем, что смотрели.
    expect(проверено).toBeGreaterThanOrEqual(2);
    expect(нарушения).toEqual([]);
  });
});
