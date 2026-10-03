import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { hasContentHash } from "@/lib/sw/content-hash";

/**
 * Файл с хешем в имени не перепроверяется в сети.
 *
 * Сборка даёт имена вида `PostCard-jC9uqpiM.js`: хеш содержимого внутри имени.
 * Изменилось содержимое — изменился адрес, значит ответ из кеша устареть не
 * может никогда.
 *
 * Замерено на проде 03.10: два перехода на `/feed` дали три полные волны
 * запросов по тем же тридцати семи файлам — кеш отвечал, а `fetch` всё равно
 * уходил. Вес набора 479 КБ сжатыми, и столько же уходило лишним трафиком на
 * каждый просмотр. Браузер девять раз ругался «preload is found, but is not
 * used because it is a cross-world service worker resource mismatch».
 *
 * Имена ниже взяты из боевой разметки, а не придуманы.
 */
describe("опознание файла с хешем в имени", () => {
  it("настоящие имена из боевой сборки опознаются", () => {
    for (const p of [
      "/assets/PostCard-jC9uqpiM.js",
      "/assets/styles-Dk_QebeD.css",
      "/assets/manrope-cyrillic-wght-normal-Dvxsihut.woff2",
      "/assets/lucide-core-BJXtR9XE.js",
      "/assets/cover-modelizm-1920-CJ8mUKhU.webp",
      "/assets/workbox-window.prod.es5-BBnX5xw4.js",
      "/assets/embla-carousel-react.esm-CpwYf0IX.js",
    ]) {
      expect(hasContentHash(p), `не опознан: ${p}`).toBe(true);
    }
  });

  it("без хеша — не опознаётся, иначе кеш пришпилит старое навсегда", () => {
    for (const p of [
      "/pwa/icon-192.png",
      "/pwa/apple-touch-icon.png",
      "/favicon.ico",
      "/manifest.webmanifest",
      "/offline.html",
      "/assets/logo.svg",
      "/assets/style.css",
    ]) {
      expect(hasContentHash(p), `ложно опознан: ${p}`).toBe(false);
    }
  });

  it("чужие пути не считаются файлами сборки", () => {
    expect(hasContentHash("/api/v1/media/abc-12345678.jpg")).toBe(false);
    expect(hasContentHash("/feed")).toBe(false);
  });

  it("короткий хвост хешем не считается", () => {
    // Семь знаков — ещё не хеш: `some-file-v1.css` опознать нельзя.
    expect(hasContentHash("/assets/some-abc1234.css")).toBe(false);
  });
});

describe("обработчик файлов развёл два случая", () => {
  const sw = readFileSync(join(import.meta.dirname, "../../sw.ts"), "utf8");

  it("у файлов с хешем — кеш без перепроверки", () => {
    expect(sw).toContain("cacheFirstImmutable");
    // Без `[^)]*`: в вызове есть вложенная скобка
    // (`hasContentHash(new URL(request.url).pathname)`), и такой отбор
    // останавливался на ней. На этом проверка и ошиблась сначала.
    expect(sw).toMatch(/hasContentHash\([\s\S]*?\?\s*cacheFirstImmutable/);
  });

  it("без хеша stale-while-revalidate остался", () => {
    expect(sw).toContain(": staleWhileRevalidate(request)");
  });

  it("у кеша файлов есть предел — VERSION между выпусками не меняется", () => {
    expect(sw).toContain("MAX_ASSET_ENTRIES");
    expect(sw).toMatch(/trimCache\(ASSET_CACHE, MAX_ASSET_ENTRIES\)/);
  });
});
