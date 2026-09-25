import { describe, it, expect } from "vitest";
import {
  applyCommunityFilter,
  categoriesOf,
  citiesOf,
  emptyReason,
  isFiltering,
  reconcileFilter,
  ПУСТОЙ_ОТБОР,
} from "./community-filters";
import type { Community } from "@/lib/mock";

const сообщество = (о: Partial<Community> & { id: string; name: string }): Community =>
  ({
    description: "",
    members: 0,
    category: "Авиация",
    categoryId: 1,
    ...о,
  }) as Community;

const список: Community[] = [
  сообщество({
    id: "1",
    name: "Самолёты",
    categoryId: 1,
    category: "Авиация",
    city: { id: 10, name: "Москва" },
  }),
  сообщество({
    id: "2",
    name: "Танки",
    categoryId: 2,
    category: "Бронетехника",
    city: { id: 11, name: "Казань" },
  }),
  сообщество({ id: "3", name: "Вертолёты", categoryId: 1, category: "Авиация", city: null }),
  сообщество({
    id: "4",
    name: "Флот",
    categoryId: 3,
    category: "Корабли",
    city: { id: 10, name: "Москва" },
  }),
];

describe("отбор сообществ", () => {
  it("пустой отбор ничего не отсекает", () => {
    expect(applyCommunityFilter(список, ПУСТОЙ_ОТБОР)).toHaveLength(4);
    expect(isFiltering(ПУСТОЙ_ОТБОР)).toBe(false);
  });

  it("по категории", () => {
    const итог = applyCommunityFilter(список, { ...ПУСТОЙ_ОТБОР, categoryId: 1 });
    expect(итог.map((c) => c.name)).toEqual(["Самолёты", "Вертолёты"]);
  });

  it("по городу", () => {
    const итог = applyCommunityFilter(список, { ...ПУСТОЙ_ОТБОР, cityId: 10 });
    expect(итог.map((c) => c.name)).toEqual(["Самолёты", "Флот"]);
  });

  it("категория и город вместе — это «и», а не «или»", () => {
    const итог = applyCommunityFilter(список, { ...ПУСТОЙ_ОТБОР, categoryId: 1, cityId: 10 });
    expect(итог.map((c) => c.name)).toEqual(["Самолёты"]);
  });

  it("сообщество без города не попадает в отбор по городу", () => {
    // «Вертолёты» без города: в отборе «Москва» его быть не должно, и в
    // отборе «Казань» тоже — у него города нет вовсе.
    for (const cityId of [10, 11]) {
      const итог = applyCommunityFilter(список, { ...ПУСТОЙ_ОТБОР, cityId });
      expect(итог.map((c) => c.name)).not.toContain("Вертолёты");
    }
  });

  it("текст ищет по имени, категории и описанию", () => {
    expect(
      applyCommunityFilter(список, { ...ПУСТОЙ_ОТБОР, query: "танк" }).map((c) => c.name),
    ).toEqual(["Танки"]);
    expect(
      applyCommunityFilter(список, { ...ПУСТОЙ_ОТБОР, query: "авиац" }).map((c) => c.name),
    ).toEqual(["Самолёты", "Вертолёты"]);
  });

  it("текст и категория сужают вместе", () => {
    const итог = applyCommunityFilter(список, {
      ...ПУСТОЙ_ОТБОР,
      query: "авиац",
      categoryId: 1,
      cityId: 10,
    });
    expect(итог.map((c) => c.name)).toEqual(["Самолёты"]);
  });

  it("любой выбранный отбор считается отбором", () => {
    expect(isFiltering({ ...ПУСТОЙ_ОТБОР, query: "  " })).toBe(false);
    expect(isFiltering({ ...ПУСТОЙ_ОТБОР, query: "а" })).toBe(true);
    expect(isFiltering({ ...ПУСТОЙ_ОТБОР, categoryId: 1 })).toBe(true);
    expect(isFiltering({ ...ПУСТОЙ_ОТБОР, cityId: 10 })).toBe(true);
  });
});

describe("варианты для выпадающих списков", () => {
  it("города — только те, что есть в списке, по алфавиту", () => {
    expect(citiesOf(список)).toEqual([
      { id: 11, name: "Казань" },
      { id: 10, name: "Москва" },
    ]);
  });

  it("категории — без повторов, по алфавиту", () => {
    expect(categoriesOf(список)).toEqual([
      { id: 1, name: "Авиация" },
      { id: 2, name: "Бронетехника" },
      { id: 3, name: "Корабли" },
    ]);
  });

  it("пустой список даёт пустые варианты", () => {
    expect(citiesOf([])).toEqual([]);
    expect(categoriesOf([])).toEqual([]);
  });
});

describe("согласование отбора со списком", () => {
  it("снимает город, которого в списке больше нет", () => {
    // Список перезапросили по другому направлению: казанских сообществ
    // в нём нет, а выбор остался бы и давал пустоту без объяснения.
    const другой = [список[0], список[2]];
    const итог = reconcileFilter({ ...ПУСТОЙ_ОТБОР, cityId: 11 }, другой);

    expect(итог.cityId).toBeNull();
  });

  it("снимает категорию, которой в списке больше нет", () => {
    const итог = reconcileFilter({ ...ПУСТОЙ_ОТБОР, categoryId: 2 }, [список[0]]);

    expect(итог.categoryId).toBeNull();
  });

  it("оставляет то, что в списке есть, и не создаёт новый объект зря", () => {
    const отбор = { ...ПУСТОЙ_ОТБОР, categoryId: 1, cityId: 10 };

    expect(reconcileFilter(отбор, список)).toBe(отбор);
  });

  it("поисковую строку не трогает", () => {
    const итог = reconcileFilter({ query: "танк", categoryId: 2, cityId: null }, [список[0]]);

    expect(итог.query).toBe("танк");
    expect(итог.categoryId).toBeNull();
  });
});

describe("что сказать на пустой выдаче", () => {
  it("есть запрос — про запрос", () => {
    expect(emptyReason({ ...ПУСТОЙ_ОТБОР, query: "танк" })).toBe("query");
    expect(emptyReason({ query: "танк", categoryId: 1, cityId: 10 })).toBe("query");
  });

  it("запроса нет, а фильтры есть — про фильтры", () => {
    // Советовать «измените запрос» тому, кто ничего не искал, — значит
    // говорить не о его действии.
    expect(emptyReason({ ...ПУСТОЙ_ОТБОР, cityId: 10 })).toBe("filters");
    expect(emptyReason({ ...ПУСТОЙ_ОТБОР, categoryId: 1 })).toBe("filters");
    expect(emptyReason({ ...ПУСТОЙ_ОТБОР, query: "   ", cityId: 10 })).toBe("filters");
  });

  it("ничего не задано — ни то, ни другое", () => {
    expect(emptyReason(ПУСТОЙ_ОТБОР)).toBe("none");
  });
});

describe("сообщества со своей категорией", () => {
  const своя = сообщество({
    id: "5",
    name: "Кружок",
    categoryId: undefined,
    category: "",
    city: { id: 10, name: "Москва" },
  });

  it("не попадают в варианты: отбирать их нечем", () => {
    expect(categoriesOf([...список, своя]).map((c) => c.name)).not.toContain("");
  });

  it("отсекаются любым отбором по категории, но видны без него", () => {
    const все = [...список, своя];
    expect(applyCommunityFilter(все, ПУСТОЙ_ОТБОР)).toHaveLength(5);
    expect(
      applyCommunityFilter(все, { ...ПУСТОЙ_ОТБОР, categoryId: 1 }).map((c) => c.name),
    ).not.toContain("Кружок");
  });

  it("находятся по городу и по строке", () => {
    const все = [...список, своя];
    expect(applyCommunityFilter(все, { ...ПУСТОЙ_ОТБОР, cityId: 10 }).map((c) => c.name)).toContain(
      "Кружок",
    );
    expect(
      applyCommunityFilter(все, { ...ПУСТОЙ_ОТБОР, query: "москв" }).map((c) => c.name),
    ).toContain("Кружок");
  });
});

describe("порядок и мелочи", () => {
  it("отбор не пересортировывает: порядок сервера сохраняется", () => {
    const итог = applyCommunityFilter(список, ПУСТОЙ_ОТБОР);
    expect(итог.map((c) => c.id)).toEqual(["1", "2", "3", "4"]);
  });

  it("строка из одних пробельных знаков отбором не считается", () => {
    expect(isFiltering({ ...ПУСТОЙ_ОТБОР, query: "\n\t " })).toBe(false);
  });

  it("город ищется строкой", () => {
    expect(
      applyCommunityFilter(список, { ...ПУСТОЙ_ОТБОР, query: "казан" }).map((c) => c.name),
    ).toEqual(["Танки"]);
  });
});
