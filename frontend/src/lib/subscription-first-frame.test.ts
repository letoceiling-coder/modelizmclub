import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Первый кадр браузера совпадает с серверным — раздел CLAUDE.md
 * «Первый кадр в браузере совпадает с серверным».
 *
 * Промпт 2 шаг 3 называл три места с тем же приёмом, что когда-то ломал
 * `/channels`: `lib/subscription.ts` и дважды `lib/hooks/useCategories.ts`.
 * Разобрано 07.10 замером, а не чтением:
 *
 * | Место | Что читалось в разметке | Расхождение по замеру |
 * | --- | --- | --- |
 * | subscription.ts | `isAuthenticated()` — токен из localStorage | нет, но приём запрещён |
 * | useCategories.ts × 2 | модульный кэш деревьев | нет, и приём законен |
 *
 * Деревья направлений кэш **засевает** `applyPublicBootstrap` из ответа
 * `/public/bootstrap` — на сервере в загрузчике корня и в браузере из той
 * же серialизованной загрузки, до отрисовки детей. То есть на обеих
 * сторонах кэш одинаков, и это не накопление между запросами: проверено
 * сравнением разметки десяти страниц, снятой на свежем процессе сервера и
 * после обхода остальных страниц, — отличий 0 из 10.
 *
 * А вот токен засеять нечем: на сервере его нет. Поэтому здесь сторож
 * именно на него.
 */
describe("подписка: первый кадр не зависит от токена", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/subscription.ts"), "utf8");
  const hook = src.slice(src.indexOf("export function useMySubscription"));

  it("срез хука непустой", () => {
    // Иначе проверки ниже искали бы в пустой строке.
    expect(hook.length).toBeGreaterThan(300);
    expect(hook).toContain("useState");
  });

  it("токен в разметке не читается", () => {
    /*
     * `isAuthenticated()` на сервере false, в браузере при гидрации true —
     * это и есть React #418 из разбора D8.
     *
     * Проверяется форма кода, а не наличие слова: сначала здесь стояло
     * `not.toContain("isAuthenticated()")`, и проверка краснела на верном
     * коде — название осталось в комментарии, который объясняет, что
     * именно убрали. Так же краснела проверка про lovable.app в
     * `lib/seo/head.test.ts`; ловушка одна и та же.
     */
    expect(hook).not.toMatch(/useState\([^)]*isAuthenticated/);
    expect(hook).not.toMatch(/useState\([^)]*getToken/);
    // И вообще вне комментария этих вызовов в хуке быть не должно.
    const безКомментариев = hook
      .replace(/\/\*[\s\S]*?\*\//g, " ")
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""))
      .join("\n");
    expect(безКомментариев).toContain("useState");
    expect(безКомментариев).not.toContain("isAuthenticated(");
    expect(безКомментариев).not.toContain("getToken(");
  });

  it("начальное «грузится» берётся из кэша", () => {
    expect(hook).toMatch(/useState\(\(\) => cache === undefined\)/);
  });

  it("«грузится» не начинается с false", () => {
    /*
     * На нём висит `needsSubscription` с `!subLoading`: мгновение false при
     * пустой подписке открыло бы подписчику окно «нужна подписка».
     */
    expect(hook).not.toMatch(/useState\(false\)[^\n]*\/\/\s*loading/);
    expect(hook).not.toMatch(/const \[loading, setLoading\] = useState\(false\)/);
  });
});

describe("модульный кэш подписки не живёт на сервере", () => {
  const src = readFileSync(join(process.cwd(), "src/lib/subscription.ts"), "utf8");

  it("запрос с сервера не выполняется и ничего не пишет", () => {
    // Процесс Node живёт сутками; ветка «не вошёл» пишет `cache = null`, и
    // один вызов из загрузчика отравил бы всех следующих посетителей.
    /*
     * Ищется строка кода, а не слово: `cache = null` упомянут и в
     * комментарии рядом, и по нему запись находилась раньше запрета —
     * проверка краснела на верном коде.
     */
    const строки = src
      .slice(src.indexOf("export async function getMySubscription"))
      .split("\n")
      .map((l) => l.replace(/\/\/.*$/, ""));
    const вне = (re: RegExp) =>
      строки.findIndex((l) => re.test(l) && !l.trimStart().startsWith("*"));
    const запрет = вне(/if \(typeof window === "undefined"\) return null;/);
    const запись = вне(/^\s*cache = null;\s*$/);
    expect(запрет, "запрета на серверный вызов нет").toBeGreaterThanOrEqual(0);
    expect(запись, "записи в кэш не найдено — проверять нечего").toBeGreaterThanOrEqual(0);
    // Запрет стоит раньше первой записи в кэш.
    expect(запрет).toBeLessThan(запись);
  });
});

describe("деревья направлений засеваются, а не копятся", () => {
  it("засев идёт из ответа bootstrap", () => {
    // Это и делает чтение кэша в разметке безопасным: на сервере и в
    // браузере он заполняется одним и тем же серialизованным ответом.
    const boot = readFileSync(join(process.cwd(), "src/lib/boot/applyPublicBootstrap.ts"), "utf8");
    expect(boot).toContain("seedPostCategoryTree");
    expect(boot).toContain("seedListingCategoryTree");
    expect(boot).toContain("data.post_categories");
  });

  it("корень применяет засев на каждом запросе", () => {
    const root = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8");
    expect(root).toContain("applyPublicBootstrap(bootstrap)");
  });
});
