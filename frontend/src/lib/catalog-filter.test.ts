import { describe, expect, it } from "vitest";
import {
  catalogNamesFromIds,
  catalogSearchForListing,
  findSubcategoryById,
  findSubcategoryByName,
  flattenSubcategories,
  parseCatalogId,
} from "./catalog-filter";
import type { Category } from "@/lib/mock";

// Дерево каталога трёхуровневое: «ил 6» лежит под «Планерами», а не рядом.
const tree: Category[] = [
  {
    id: "101",
    name: "Авиация",
    description: "",
    icon: "Plane",
    members: 0,
    subcategories: [
      { id: "110", name: "Планеры", children: [{ id: "100", name: "ил 6" }] },
      { id: "102", name: "ДВС" },
    ],
  },
];

describe("parseCatalogId", () => {
  it("принимает число и строку, отсекает мусор", () => {
    expect(parseCatalogId(101)).toBe(101);
    expect(parseCatalogId("101")).toBe(101);
    expect(parseCatalogId("0")).toBeUndefined();
    expect(parseCatalogId("-3")).toBeUndefined();
    expect(parseCatalogId("101abc")).toBeUndefined();
    expect(parseCatalogId(undefined)).toBeUndefined();
  });
});

describe("catalogSearchForListing", () => {
  it("даёт оба идентификатора", () => {
    expect(catalogSearchForListing("101", "100")).toEqual({
      category_id: 101,
      subcategory_id: 100,
    });
  });

  it("без подкатегории — только категория", () => {
    expect(catalogSearchForListing("101", undefined)).toEqual({ category_id: 101 });
  });

  it("без категории адреса нет: подкатегория без родителя ничего не отбирает", () => {
    expect(catalogSearchForListing(undefined, "100")).toEqual({});
  });
});

describe("catalogNamesFromIds", () => {
  it("переводит идентификаторы в названия", () => {
    expect(catalogNamesFromIds(tree, 101, 100)).toEqual({
      category: "Авиация",
      subcategory: "ил 6",
    });
  });

  it("без подкатегории — «Все»", () => {
    expect(catalogNamesFromIds(tree, 101)).toEqual({ category: "Авиация", subcategory: "Все" });
  });

  it("чужая подкатегория не подставляется к категории", () => {
    expect(catalogNamesFromIds(tree, 101, 999)).toEqual({
      category: "Авиация",
      subcategory: "Все",
    });
  });

  it("неизвестная категория — ничего, отбор не выдумывается", () => {
    expect(catalogNamesFromIds(tree, 777, 100)).toBeNull();
    expect(catalogNamesFromIds([], 101)).toBeNull();
    expect(catalogNamesFromIds(tree, undefined)).toBeNull();
  });
});

describe("поиск подраздела по всему поддереву", () => {
  it("находит внука по идентификатору и по названию", () => {
    expect(findSubcategoryById(tree[0], 100)?.name).toBe("ил 6");
    expect(findSubcategoryByName(tree[0], "ил 6")?.id).toBe("100");
  });

  it("находит прямого ребёнка", () => {
    expect(findSubcategoryById(tree[0], 102)?.name).toBe("ДВС");
    expect(findSubcategoryByName(tree[0], "Планеры")?.id).toBe("110");
  });

  it("чужого не выдумывает", () => {
    expect(findSubcategoryById(tree[0], 999)).toBeNull();
    expect(findSubcategoryByName(tree[0], "Все")).toBeNull();
  });
});

describe("flattenSubcategories", () => {
  it("даёт весь список подразделов, включая третий уровень", () => {
    expect(flattenSubcategories(tree[0]).map((n) => n.name)).toEqual(["Планеры", "ил 6", "ДВС"]);
  });

  it("у раздела без подразделов список пуст", () => {
    expect(flattenSubcategories({ ...tree[0], subcategories: [] }).map((n) => n.name)).toEqual([]);
  });
});
