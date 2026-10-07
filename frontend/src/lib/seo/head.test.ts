import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import {
  SITE_ORIGIN,
  absoluteImage,
  absoluteUrl,
  breadcrumbNode,
  jsonLdScript,
  metaDescription,
  pageHead,
} from "./head";
import { CLOSED_PATH_PREFIXES, isClosedPath } from "./closed-paths";

/**
 * Метаданные публичных страниц. ТЗ раздел 2, промпт 2 шаг 2.
 *
 * Замер 07.10 на боевой сборке, запросом без браузера, до и после:
 *
 * | Страница | title до | title после |
 * | --- | --- | --- |
 * | `/ads/{uuid}` | «Объявление — МоДелизМ» | «Набор Tamiya P-51D 1:48, запечатан — МоДелизМ» |
 * | `/channel/tamiya` | «Канал — МоДелизМ» | «Tamiya News — МоДелизМ» |
 * | `/communities/{slug}` | «Сообщество — МоДелизМ» | «1/35 Россия — МоДелизМ» |
 * | `/user/{uuid}` | «Профиль — МоДелизМ» | «ФФ Борис (Б) — МоДелизМ» |
 * | `/reviews/{uuid}` | «Обзор — МоДелизМ» | «Обзор сборки P-51 — МоДелизМ» |
 *
 * canonical было у 2 страниц из 13, стало у 13; ld+json было у 2, стало у 5
 * (лендинг, канал, сообщество и две правовые).
 *
 * Здесь проверяется сама сборка метаданных — она чистая, и её поведение
 * можно проверить без браузера, — плюс согласованность списка закрытых
 * адресов с robots.txt.
 */
describe("метаданные страницы", () => {
  it("своё имя уходит в заголовок, а хвост площадки — только в title", () => {
    const { meta } = pageHead({ title: "Набор Tamiya P-51D", path: "/ads/1", fallbackTitle: "з" });
    expect(meta.find((m) => m.title)?.title).toBe("Набор Tamiya P-51D — МоДелизМ");
    // В превью мессенджера хвост площадки лишний: там рядом и так её имя.
    expect(meta.find((m) => m.property === "og:title")?.content).toBe("Набор Tamiya P-51D");
  });

  it("без своего имени остаётся запасной заголовок, а не пустой", () => {
    const { meta } = pageHead({
      title: null,
      path: "/ads/1",
      fallbackTitle: "Объявление — МоДелизМ",
    });
    expect(meta.find((m) => m.title)?.title).toBe("Объявление — МоДелизМ");
  });

  it("пустое имя из данных не превращается в « — МоДелизМ»", () => {
    const { meta } = pageHead({ title: "   ", path: "/x", fallbackTitle: "Запас" });
    expect(meta.find((m) => m.title)?.title).toBe("Запас");
  });

  it("канонический адрес абсолютный и без параметров", () => {
    const { links } = pageHead({ path: "/ads/1", fallbackTitle: "з" });
    expect(links).toEqual([{ rel: "canonical", href: `${SITE_ORIGIN}/ads/1` }]);
  });

  it("описания нет вовсе, когда у сущности его нет", () => {
    // Общий текст про площадку в карточке врёт; пустое поле поисковик
    // заполняет сам.
    const { meta } = pageHead({
      title: "Канал",
      description: "  ",
      path: "/c",
      fallbackTitle: "з",
    });
    expect(meta.some((m) => m.name === "description")).toBe(false);
    expect(meta.some((m) => m.property === "og:description")).toBe(false);
  });

  it("SVG-аватар в превью не уходит", () => {
    // Ни один мессенджер его не рисует: такой тег хуже отсутствия, потому
    // что перекрывает превью площадки пустым местом.
    const { meta } = pageHead({
      title: "Борис",
      path: "/user/1",
      image: "https://api.dicebear.com/7.x/initials/svg?seed=%D0%91",
      fallbackTitle: "з",
    });
    expect(meta.some((m) => m.property === "og:image")).toBe(false);
  });

  it("обычная картинка в превью уходит и становится абсолютной", () => {
    const { meta } = pageHead({
      title: "Набор",
      path: "/ads/1",
      image: "/assets/cover.webp",
      fallbackTitle: "з",
    });
    expect(meta.find((m) => m.property === "og:image")?.content).toBe(
      `${SITE_ORIGIN}/assets/cover.webp`,
    );
    expect(meta.find((m) => m.name === "twitter:card")?.content).toBe("summary_large_image");
  });

  it("закрытая страница помечается noindex, но ссылки с неё читаются", () => {
    const { meta } = pageHead({ path: "/settings", fallbackTitle: "з", noindex: true });
    expect(meta.find((m) => m.name === "robots")?.content).toBe("noindex, follow");
  });

  it("открытая страница метки robots не получает", () => {
    const { meta } = pageHead({ path: "/ads", fallbackTitle: "з" });
    expect(meta.some((m) => m.name === "robots")).toBe(false);
  });
});

describe("описание для выдачи", () => {
  it("разметка выбрасывается, пробелы сжимаются", () => {
    expect(metaDescription("<p>Текст  с\n разметкой</p>")).toBe("Текст с разметкой");
  });

  it("обрезается по слову, а не посередине", () => {
    const d = metaDescription("раз два три четыре пять шесть семь восемь", 20);
    expect(d?.endsWith("…")).toBe(true);
    expect(d).not.toMatch(/\s…$/);
    expect(d!.length).toBeLessThanOrEqual(21);
    expect(d).toBe("раз два три четыре…");
  });

  it("короткое не обрезается и многоточия не получает", () => {
    expect(metaDescription("Коротко")).toBe("Коротко");
  });

  it("пустое и отсутствующее дают null, а не пустую строку", () => {
    expect(metaDescription("   ")).toBeNull();
    expect(metaDescription(null)).toBeNull();
    expect(metaDescription(undefined)).toBeNull();
  });
});

describe("адреса", () => {
  it("относительный путь становится абсолютным", () => {
    expect(absoluteUrl("/ads")).toBe(`${SITE_ORIGIN}/ads`);
    expect(absoluteUrl("ads")).toBe(`${SITE_ORIGIN}/ads`);
  });

  it("уже абсолютная картинка не переписывается", () => {
    expect(absoluteImage("https://cdn.example/a.jpg")).toBe("https://cdn.example/a.jpg");
  });

  it("пустая картинка даёт null", () => {
    expect(absoluteImage("")).toBeNull();
    expect(absoluteImage(null)).toBeNull();
  });
});

describe("хлебные крошки", () => {
  it("путь начинается с площадки и нумеруется с единицы", () => {
    const n = breadcrumbNode([
      { name: "Объявления", path: "/ads" },
      { name: "Набор", path: "/ads/1" },
    ]) as {
      itemListElement: { position: number; name: string; item: string }[];
    };
    expect(n.itemListElement.map((e) => e.position)).toEqual([1, 2, 3]);
    expect(n.itemListElement[0].name).toBe("МоДелизМ");
    expect(n.itemListElement[2].item).toBe(`${SITE_ORIGIN}/ads/1`);
  });
});

describe("структурированные данные", () => {
  it("пустой список тега не рождает", () => {
    expect(jsonLdScript([])).toEqual([]);
  });

  it("в теге лежит разбираемый JSON с @context", () => {
    const [s] = jsonLdScript([{ "@type": "Thing" }]);
    const d = JSON.parse(s.children) as { "@context": string; "@graph": unknown[] };
    expect(d["@context"]).toBe("https://schema.org");
    expect(d["@graph"]).toHaveLength(1);
  });
});

describe("список закрытых адресов совпадает с robots.txt", () => {
  const robots = readFileSync(join(process.cwd(), "public/robots.txt"), "utf8");
  const disallow = robots
    .split("\n")
    .filter((l) => l.startsWith("Disallow:"))
    .map((l) => l.replace("Disallow:", "").trim())
    .filter((p) => p !== "/api/" && p !== "/docs");

  it("robots.txt непустой и строки Disallow разобраны", () => {
    // Иначе сравнение ниже проходило бы на пустых списках.
    expect(disallow.length).toBeGreaterThan(20);
  });

  it("каждый закрытый от обхода адрес помечен и на странице", () => {
    // Расхождение значит, что одна из двух защит молча не работает.
    const лишние = disallow.filter((p) => !CLOSED_PATH_PREFIXES.includes(p));
    expect(лишние, `в robots.txt есть, в списке страниц нет: ${лишние.join(", ")}`).toEqual([]);
  });

  it("и наоборот: помеченное на странице закрыто и от обхода", () => {
    const лишние = CLOSED_PATH_PREFIXES.filter((p) => !disallow.includes(p));
    expect(лишние, `помечено noindex, но не закрыто в robots.txt: ${лишние.join(", ")}`).toEqual(
      [],
    );
  });

  it("вложенный адрес закрыт вместе с разделом", () => {
    expect(isClosedPath("/settings")).toBe(true);
    expect(isClosedPath("/settings/security")).toBe(true);
    expect(isClosedPath("/messenger?chat=12")).toBe(false); // путь приходит без параметров
  });

  it("похожий по началу адрес открытым и остаётся", () => {
    // `/ads/new` закрыт, а само объявление — нет.
    expect(isClosedPath("/ads")).toBe(false);
    expect(isClosedPath("/ads/22e3df81")).toBe(false);
    expect(isClosedPath("/ads/new")).toBe(true);
  });

  it("публичные разделы не закрыты", () => {
    for (const p of [
      "/",
      "/ads",
      "/reviews",
      "/channels",
      "/communities",
      "/feed",
      "/legal/rules",
    ]) {
      expect(isClosedPath(p), p).toBe(false);
    }
  });
});

describe("превью по умолчанию — своё, а не прототипа", () => {
  it("превью по умолчанию не ведёт на прототип", () => {
    /*
     * Снимок экрана прототипа на чужом ведре R2 уезжал в каждую ссылку на
     * сайт; найдено 07.10.
     *
     * Проверяется значение тега, а не наличие слова в файле: сначала здесь
     * стояло `not.toContain("lovable.app")`, и проверка краснела на верном
     * коде — слово осталось в комментарии, который объясняет, что именно
     * убрали. Разбор в комментарии нужен, значит проверять надо значение.
     */
    const root = readFileSync(join(process.cwd(), "src/routes/__root.tsx"), "utf8");
    const превью = [...root.matchAll(/(?:og:image|twitter:image)"[^}]*?content:\s*([^\n]+)/g)].map(
      (m) => m[1],
    );
    expect(превью.length, "теги превью в корневом маршруте не найдены").toBeGreaterThanOrEqual(2);
    for (const значение of превью) {
      expect(значение).not.toContain("lovable.app");
      expect(значение).not.toContain("r2.dev");
      expect(значение).toContain("SITE_ORIGIN");
    }
  });
});
