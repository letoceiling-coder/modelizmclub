import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * Ориентир и заголовок первого уровня на страницах, где их не было.
 *
 * Гейт 3.5.3 требует ровно один `<main>` и один `<h1>` на странице. Замеры
 * 05.10 на 320, 360, 390 и 1280 нашли два места, где требование не
 * выполнялось:
 *
 *  — `/post/{uuid}`: ни `<h1>`, ни `<h2>` на странице нет вовсе. Название
 *    записи выводится в карточке обычным текстом и попадает в заголовок
 *    окна, но разметкой заголовка не является;
 *  — `404`: `main=0`. Служебные страницы рисуются вне `AppLayout`, который
 *    даёт `<main>` остальным.
 *
 * Проверки читают исходник: оба требования задаются одним узлом, и ломаются
 * его заменой, а не разметкой вокруг.
 */
const POST_PAGE = join(import.meta.dirname, "post.$uuid.tsx");
const ROOT = join(import.meta.dirname, "__root.tsx");

describe("страница записи", () => {
  it("даёт заголовок первого уровня", () => {
    const источник = readFileSync(POST_PAGE, "utf8");

    expect(источник).toMatch(/<h1[^>]*>\{postTitle\(post\)\}<\/h1>/);
  });

  it("заголовок берётся готовым помощником, а не вторым вычислением", () => {
    const источник = readFileSync(POST_PAGE, "utf8");

    // postTitle уже считает название для заголовка окна и og:title.
    expect(источник).toContain("function postTitle(");
    expect(источник.match(/postTitle\(/g)?.length ?? 0).toBeGreaterThanOrEqual(2);
  });

  it("заголовок не уехал в общую карточку записи", async () => {
    // PostCard рисуется и в ленте, и в профиле, и в сообществе, и в канале:
    // <h1> внутри неё дал бы на этих страницах по заголовку на запись.
    const card = readFileSync(
      join(import.meta.dirname, "..", "components", "post", "PostCard.tsx"),
      "utf8",
    );

    expect(card).not.toContain("<h1");
  });
});

describe("служебные страницы", () => {
  it("404 и общая ошибка обёрнуты в main", () => {
    const источник = readFileSync(ROOT, "utf8");
    const notFound = источник.slice(
      источник.indexOf("function NotFoundComponent"),
      источник.indexOf("function ErrorComponent"),
    );
    const error = источник.slice(
      источник.indexOf("function ErrorComponent"),
      источник.indexOf("export const Route"),
    );

    expect(notFound, "у 404 нет внешнего <main>").toContain("<main");
    expect(error, "у страницы общей ошибки нет внешнего <main>").toContain("<main");
  });

  it("404 сохраняет заголовок первого уровня", () => {
    const источник = readFileSync(ROOT, "utf8");
    const notFound = источник.slice(
      источник.indexOf("function NotFoundComponent"),
      источник.indexOf("function ErrorComponent"),
    );

    expect(notFound).toContain("<h1");
  });
});
