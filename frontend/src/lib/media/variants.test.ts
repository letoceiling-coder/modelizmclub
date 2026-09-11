import { describe, expect, it } from "vitest";

import { pictureSrcSet, type DisplayMedia } from "@/lib/media/variants";

const media: DisplayMedia = {
  url: "https://cdn.test/original.png",
  variants: {
    thumb: { avif: "t.avif", webp: "t.webp", jpeg: "t.jpg" },
    card: { avif: "c.avif", webp: "c.webp", jpeg: "c.jpg" },
  },
};

/** AVIF есть не у всех размеров: у карточки он тяжелее WebP и не отдан. */
const partialAvif: DisplayMedia = {
  url: "https://cdn.test/original.png",
  variants: {
    thumb: { avif: "t.avif", webp: "t.webp", jpeg: "t.jpg" },
    card: { webp: "c.webp", jpeg: "c.jpg" },
  },
};

describe("pictureSrcSet", () => {
  it("offers avif before webp before jpeg", () => {
    const { sources } = pictureSrcSet(media, ["thumb", "card"]);
    expect(sources.map((s) => s.format)).toEqual(["avif", "webp", "jpeg"]);
    expect(sources[0]).toMatchObject({ type: "image/avif", srcSet: "t.avif 320w, c.avif 640w" });
  });

  /*
   * Браузер выбирает из первого понятного ему `<source>` и дальше не идёт.
   * AVIF-источник с одной шириной 320w заставил бы его растянуть thumb на
   * карточку в 640, поэтому неполный формат не предлагается вовсе.
   */
  it("drops a format that does not cover every size", () => {
    const { sources } = pictureSrcSet(partialAvif, ["thumb", "card"]);
    expect(sources.map((s) => s.format)).toEqual(["webp", "jpeg"]);
  });

  it("keeps width descriptors per variant", () => {
    const { sources } = pictureSrcSet(media, ["thumb", "card"]);
    const webp = sources.find((s) => s.format === "webp");
    expect(webp?.srcSet).toBe("t.webp 320w, c.webp 640w");
  });

  it("falls back to the original when there are no variants", () => {
    const { sources, src } = pictureSrcSet({ url: "https://cdn.test/x.png" }, ["card"]);
    expect(sources).toEqual([]);
    expect(src).toBe("https://cdn.test/x.png");
  });
});
