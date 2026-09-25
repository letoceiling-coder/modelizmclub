import { describe, it, expect } from "vitest";
import {
  byOrder,
  canMove,
  childrenOf,
  depthOf,
  heightOf,
  parentOptions,
  pathOf,
  reordered,
  sortOrderAt,
  subtreeOf,
  type TreeNode,
} from "./category-tree";

const узел = (id: number, name: string, parentId: number | null, sortOrder = 0): TreeNode => ({
  id,
  name,
  parentId,
  sortOrder,
});

describe("порядок", () => {
  it("равные номера разводит имя", () => {
    const ряд = [узел(2, "Бронетехника", null), узел(1, "Авиация", null)].sort(byOrder);
    expect(ряд.map((x) => x.name)).toEqual(["Авиация", "Бронетехника"]);
  });

  it("дети отдаются в том же порядке, что на экране", () => {
    const items = [узел(1, "Авиация", null), узел(3, "Вертолёты", 1, 5), узел(2, "Самолёты", 1, 1)];
    expect(childrenOf(items, 1).map((x) => x.name)).toEqual(["Самолёты", "Вертолёты"]);
  });
});

describe("перестановка", () => {
  it("на краях ряда двигать некуда", () => {
    const items = [узел(1, "А", null, 10), узел(2, "Б", null, 20)];
    expect(canMove(items, items[0], -1)).toBe(false);
    expect(canMove(items, items[1], 1)).toBe(false);
    expect(canMove(items, items[0], 1)).toBe(true);
  });

  it("ряд из одинаковых нулей всё-таки перестраивается", () => {
    // Обмен значений тут не сработал бы: ноль на ноль — это ничего.
    const items = [узел(1, "А", null, 0), узел(2, "Б", null, 0), узел(3, "В", null, 0)];

    expect(reordered(items, items[1], -1).map((x) => x.name)).toEqual(["Б", "А", "В"]);
  });

  it("сосед с тем же номером, что у третьего, не путает порядок", () => {
    // Значения 0, 5, 5: обмен 5 и 0 поставил бы «А» в хвост своего же ряда.
    const items = [узел(1, "В", null, 0), узел(2, "А", null, 5), узел(3, "Б", null, 5)];

    expect(reordered(items, items[1], -1).map((x) => x.name)).toEqual(["А", "В", "Б"]);
  });

  it("новые номера идут шагом десять — как в справочнике и на сервере", () => {
    const items = [узел(1, "А", null, 10), узел(2, "Б", null, 20), узел(3, "В", null, 30)];
    const ряд = reordered(items, items[2], -1);

    expect(ряд.map((x) => x.id)).toEqual([1, 3, 2]);
    expect(ряд.map((_, i) => sortOrderAt(i))).toEqual([10, 20, 30]);
  });

  it("узел меняется местами только со своим соседом по родителю", () => {
    const items = [
      узел(1, "Авиация", null, 10),
      узел(2, "Самолёты", 1, 10),
      узел(3, "Бронетехника", null, 20),
      узел(4, "Танки", 3, 10),
    ];

    expect(canMove(items, items[1], 1)).toBe(false);
    expect(reordered(items, items[1], 1)).toEqual([]);
  });
});

describe("выбор родителя", () => {
  const дерево = (): TreeNode[] => [
    узел(1, "Авиация", null, 0),
    узел(2, "Вторая мировая", 1, 0),
    узел(3, "Истребители", 2, 0),
    узел(4, "Бронетехника", null, 1),
  ];

  it("глубина и высота считаются по дереву", () => {
    const items = дерево();
    expect(depthOf(items, 3)).toBe(2);
    expect(heightOf(items, 1)).toBe(2);
    expect(heightOf(items, 3)).toBe(0);
    expect([...subtreeOf(items, 1)]).toEqual([1, 2, 3]);
  });

  it("путь показывает, чей это узел", () => {
    const items = дерево();
    expect(pathOf(items, items[2])).toBe("Авиация → Вторая мировая → Истребители");
  });

  it("ветку нельзя вложить в саму себя", () => {
    const items = дерево();
    expect(parentOptions(items, items[0]).map((x) => x.label)).toEqual([]);
  });

  it("узел с внуками некуда переносить — четвёртого уровня нет", () => {
    // У «Авиации» высота 2, любой родитель дал бы ей глубину 1 и внукам 3.
    const items = дерево();
    expect(parentOptions(items, items[0])).toEqual([]);
  });

  it("лист можно положить и в корень второго уровня, и рядом", () => {
    const items = дерево();
    expect(parentOptions(items, items[2]).map((x) => x.label)).toEqual([
      "Авиация",
      "Авиация → Вторая мировая",
      "Бронетехника",
    ]);
  });

  it("узел с детьми ложится только под корень", () => {
    const items = дерево();
    // «Вторая мировая» высотой 1: под корень (глубина 0) можно, под
    // «Истребители» (глубина 2) — нет. Нынешний родитель остаётся в
    // списке: он и есть выбранное значение.
    expect(parentOptions(items, items[1]).map((x) => x.label)).toEqual(["Авиация", "Бронетехника"]);
  });
});
