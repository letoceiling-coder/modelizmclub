import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Форма входа рисуется гостю сразу, а не после проверки сессии.
 *
 * Было: `if (checkingSession) return null`, и `checkingSession` заводится
 * как `true`. Сервер отдавал на /login пустую оболочку, браузер держал её
 * до конца `ensureSession()`. Замер на проде 04.10 (1,6 Мбит/с, 4×
 * процессор, 390 px, медиана трёх прогонов): первый байт за 14 мс, первая
 * отрисовка на 3276 мс; в разметке ноль `<input>`, ноль `<form>`, ни слова
 * «Войти». У /how-to-use с тем же бандлом — 1560 мс.
 *
 * Проверяем условие раннего выхода, а не наличие слов: `return null` сам по
 * себе не дефект, дефект — выход, не спрашивающий про токен. Поэтому
 * сравнение идёт по тексту условия.
 *
 * Код читается без комментариев: иначе проверка цепляется за этот же
 * докблок и за объяснение в самом login.tsx.
 */
const КОРЕНЬ = join(import.meta.dirname ?? __dirname);

function безКомментариев(путь: string): string {
  return readFileSync(join(КОРЕНЬ, путь), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ");
}

describe("вход рисуется гостю сразу", () => {
  const код = безКомментариев("login.tsx");

  it("ранний выход спрашивает про токен, а не только про проверку сессии", () => {
    const выходы = [...код.matchAll(/if\s*\(([^)]*checkingSession[^)]*)\)\s*return null/g)].map(
      (m) => m[1].trim(),
    );
    expect(выходы.length).toBe(1);
    expect(выходы[0]).toMatch(/hasToken/);
  });

  it("токен читается хуком, безопасным для гидрации", () => {
    expect(код).toMatch(/useHasToken\(\)/);
    expect(код).toMatch(/from "@\/hooks\/use-has-token"/);
  });

  it("форма и кнопка входа остаются в разметке страницы", () => {
    expect(код).toMatch(/PasswordInput/);
    expect(код).toMatch(/AuthShell/);
  });
});
