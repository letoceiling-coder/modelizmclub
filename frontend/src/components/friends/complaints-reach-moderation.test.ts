import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Каждая кнопка «Пожаловаться» отправляет жалобу, а не обращение.
 *
 * `ComplaintDialog` без пропа `report` пишет в «Книгу замечаний»
 * (POST /feedback). Там жалобу никто не ищет: сотрудникам о ней не сообщается,
 * в «Модерации → Жалобы» её нет. Так вышло со страницей обзора — на проде
 * обращение 6 «Жалоба на пользователя «Admin User» (обзор): Спам» от 23.08
 * так и стоит новым, а вкладка жалоб «Обзоры» пуста.
 */
const SRC = join(import.meta.dirname, "..", "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx$/.test(name)) out.push(full);
  }
  return out;
}

describe("ComplaintDialog", () => {
  it("везде вызывается с report — жалоба уходит в очередь жалоб", () => {
    const missing: string[] = [];
    let usages = 0;
    for (const file of walk(SRC)) {
      const source = readFileSync(file, "utf8");
      for (const match of source.matchAll(/<ComplaintDialog\b([\s\S]*?)\/>/g)) {
        usages += 1;
        if (!/\breport=/.test(match[1])) {
          missing.push(file.slice(SRC.length + 1));
        }
      }
    }
    expect(usages).toBeGreaterThan(5);
    expect(missing).toEqual([]);
  });
});
