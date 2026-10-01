import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

// Предикат берётся из `lib`, а не из компонента: чистое условие
// проверяется без загрузки разметки и всей её цепочки зависимостей.
import { shouldExplainEmptyDirections, type AdminAccess } from "@/lib/admin-access";

/**
 * Пустые разделы у администратора направления объясняются словами.
 *
 * Право на разделы даёт роль, а не список направлений, поэтому он входит
 * в админку и видит пустые списки: `CategoryScope` подставляет в запросы
 * пустую выборку. Снаружи это не отличить от поломки — и человек решает,
 * что сломано. Право оставлено как есть, добавлено объяснение.
 */
function доступ(part: Partial<AdminAccess>): AdminAccess {
  return {
    role: "category_admin",
    isOwner: false,
    sections: ["content", "ads", "moderation"],
    capabilities: [],
    categories: [],
    ...part,
  };
}

describe("объяснение пустых разделов", () => {
  it("показывается администратору направления без направлений", () => {
    expect(shouldExplainEmptyDirections(доступ({}))).toBe(true);
  });

  it("не показывается, когда направления назначены", () => {
    expect(
      shouldExplainEmptyDirections(
        доступ({ categories: [{ id: 1, name: "Авиация", slug: "av" }] }),
      ),
    ).toBe(false);
  });

  it("не показывается владельцу и модератору — у них нет такого ограничения", () => {
    expect(shouldExplainEmptyDirections(доступ({ role: "owner", isOwner: true }))).toBe(false);
    expect(shouldExplainEmptyDirections(доступ({ role: "moderator" }))).toBe(false);
  });

  it("молчит, пока карта прав не приехала", () => {
    // Плашка, мигнувшая и исчезнувшая, хуже отсутствующей.
    expect(shouldExplainEmptyDirections(null)).toBe(false);
  });
});

describe("оболочка админки", () => {
  it("рисует объяснение во всех разделах, а не в одном", () => {
    // Роли открыты три раздела, и пусто в каждом по одной причине —
    // поэтому плашка стоит в оболочке, рядом с <SectionView>.
    const оболочка = readFileSync(
      join(import.meta.dirname, "..", "..", "routes", "admin.lazy.tsx"),
      "utf8",
    );
    const место = оболочка.indexOf("<EmptyDirectionsNotice />");

    expect(место, "плашки нет в оболочке — она покрыла бы только один раздел").toBeGreaterThan(-1);

    // Именно отрисовка раздела, а не объявление компонента выше в файле:
    // первая версия этой проверки нашла объявление и упала на нём.
    expect(
      оболочка.indexOf("<SectionView section=", место),
      "плашка должна стоять до отрисовки раздела",
    ).toBeGreaterThan(место);

    // И вне переключателя разделов: внутри она перемонтировалась бы и
    // анимировалась на каждой смене раздела.
    expect(место, "плашка внутри ReducedMotionSwitch").toBeLessThan(
      оболочка.indexOf("<ReducedMotionSwitch"),
    );
  });
});
