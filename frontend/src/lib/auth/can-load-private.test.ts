import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Денежные страницы не начинают загрузку без токена.
 *
 * Аудит 04.10, гостем: `/settings/wallet` отправлял три запроса и получал
 * три 401, `/settings/requisites` — два, `/settings/payment-methods` — один.
 * Страница при этом остаётся на экране под окном входа, и так задумано, —
 * но шесть заведомо отказных запросов ей не нужны.
 *
 * Проверяем исходник, а не поведение: поднять эти экраны в проверке значит
 * поднять половину приложения, а защита — одно условие в начале загрузки,
 * и его отсутствие видно прямо в тексте.
 *
 * Код читается без комментариев: иначе проверка цепляется за упоминание
 * `canLoadPrivateData` в докблоках, которыми эти правки объяснены.
 */
const МАРШРУТЫ = join(import.meta.dirname ?? __dirname, "..", "..", "routes");

const СТРАНИЦЫ: Record<string, number> = {
  "settings.wallet.tsx": 1,
  "settings.payment-methods.tsx": 1,
  "settings.requisites.tsx": 2,
};

function безКомментариев(файл: string): string {
  return readFileSync(join(МАРШРУТЫ, файл), "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .replace(/(^|[^:])\/\/.*$/gm, "$1 ");
}

describe("денежные страницы не ходят в API без токена", () => {
  for (const [файл, сколько] of Object.entries(СТРАНИЦЫ)) {
    it(`${файл}: защит ровно ${сколько}`, () => {
      const код = безКомментариев(файл);
      const защит = [...код.matchAll(/if\s*\(\s*!canLoadPrivateData\(\)\s*\)\s*return/g)].length;
      expect(защит).toBe(сколько);
      expect(код).toMatch(/from "@\/lib\/auth\/can-load-private"/);
    });
  }

  it("защита пропускает демо-режим, иначе кошелёк показал бы пустоту вместо примера", () => {
    const источник = readFileSync(
      join(МАРШРУТЫ, "..", "lib", "auth", "can-load-private.ts"),
      "utf8",
    )
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .replace(/(^|[^:])\/\/.*$/gm, "$1 ");
    expect(источник).toMatch(/isDemoMode\(\)/);
    expect(источник).toMatch(/getToken\(\)/);
  });
});
