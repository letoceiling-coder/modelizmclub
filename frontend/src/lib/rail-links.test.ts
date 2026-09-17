import { describe, expect, it } from "vitest";
import { railChatHref, railFilterHref, railNameHref } from "./rail-links";

// Путь «Авиация → Планеры → ИЛ-6»: каждый уровень ведёт на свою страницу,
// где бы панель ни стояла, — у функций нет ни варианта, ни раздела.
const levels = [
  { id: "1", slug: "aviation" },
  { id: "31", slug: "gliders" },
  { id: "140", slug: "il-6" },
];

describe("rail links", () => {
  it("names lead to the page of their own level", () => {
    expect(levels.map(railNameHref)).toEqual([
      "/categories/aviation",
      "/categories/gliders",
      "/categories/il-6",
    ]);
  });

  it("chat icon leads to the room of its own level", () => {
    expect(railChatHref(levels[2])).toBe("/categories/il-6");
  });

  it("falls back to the id when a node has no slug", () => {
    expect(railNameHref({ id: "137" })).toBe("/categories/137");
  });

  it("never points back into a section list", () => {
    for (const node of levels) {
      expect(railNameHref(node)).not.toMatch(/taxonomy_id|communities|channels/);
    }
  });

  it("the in-node filter row narrows the feed", () => {
    expect(railFilterHref("1")).toBe("/feed?taxonomy_id=1");
  });
});
