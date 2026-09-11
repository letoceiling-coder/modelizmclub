import { describe, expect, it } from "vitest";
import { buildEmojiCatalog, searchEmojis, type RawEmoji, type RawGroupMessage } from "./catalog";
import { pushRecentEmoji, RECENT_EMOJI_LIMIT } from "./recent";
import { emojiCatalog } from "./dataset";

const groups: RawGroupMessage[] = [
  { key: "smileys-emotion", message: "смайлики и люди", order: 0 },
  { key: "component", message: "компонент", order: 2 },
  { key: "animals-nature", message: "животные и природа", order: 3 },
];

const emojis: RawEmoji[] = [
  { unicode: "😂", label: "слезы радости", group: 0, order: 2, tags: ["смех", "лицо"] },
  { unicode: "😀", label: "широко улыбается", group: 0, order: 1, tags: ["лицо", "радость"] },
  { unicode: "🏻", label: "светлый тон кожи", group: 2, order: 3 },
  { unicode: "🐱", label: "морда кота", group: 3, order: 4, tags: ["кот", "кошка"] },
  { unicode: "🇦", label: "региональный показатель A" },
  { label: "без символа", group: 0, order: 5 },
];

describe("buildEmojiCatalog", () => {
  const catalog = buildEmojiCatalog(emojis, groups);

  it("drops the component group, groupless and symbol-less entries", () => {
    expect(catalog.categories.map((c) => c.key)).toEqual(["smileys-emotion", "animals-nature"]);
    expect(catalog.all.map((e) => e.unicode)).toEqual(["😀", "😂", "🐱"]);
  });

  it("capitalizes Russian group names", () => {
    expect(catalog.categories[0].name).toBe("Смайлики и люди");
  });
});

describe("searchEmojis", () => {
  const { all } = buildEmojiCatalog(emojis, groups);

  it("matches labels and tags case-insensitively, ё as е", () => {
    expect(searchEmojis(all, "КОТ").map((e) => e.unicode)).toEqual(["🐱"]);
    expect(searchEmojis(all, "слёзы").map((e) => e.unicode)).toEqual(["😂"]);
    // 😂 — слово названия начинается с запроса, 😀 — совпадение только по тегу.
    expect(searchEmojis(all, "радост").map((e) => e.unicode)).toEqual(["😂", "😀"]);
  });

  it("requires every word to match", () => {
    expect(searchEmojis(all, "лицо смех").map((e) => e.unicode)).toEqual(["😂"]);
  });

  it("returns nothing for an empty or unmatched query", () => {
    expect(searchEmojis(all, "   ")).toEqual([]);
    expect(searchEmojis(all, "дракон")).toEqual([]);
  });
});

describe("emojibase dataset", () => {
  it("contains the full set without modifiers", () => {
    expect(emojiCatalog.all.length).toBeGreaterThan(1800);
    expect(emojiCatalog.categories.some((c) => c.key === "component")).toBe(false);
    expect(emojiCatalog.byUnicode.has("🏻")).toBe(false);
  });

  it("finds the cat face by a Russian word", () => {
    expect(searchEmojis(emojiCatalog.all, "кот").map((e) => e.unicode)).toContain("🐱");
  });
});

describe("pushRecentEmoji", () => {
  it("puts the latest first, dedupes and caps the list", () => {
    expect(pushRecentEmoji(["😀", "😂"], "😂")).toEqual(["😂", "😀"]);
    const long = Array.from({ length: RECENT_EMOJI_LIMIT }, (_, i) => String(i));
    const next = pushRecentEmoji(long, "🐱");
    expect(next).toHaveLength(RECENT_EMOJI_LIMIT);
    expect(next[0]).toBe("🐱");
  });
});
