import { describe, expect, it } from "vitest";

import { pictureSrcSet, type DisplayMedia } from "@/lib/media/variants";

const media: DisplayMedia = {
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
    expect(sources[0]).toMatchObject({ type: "image/avif", srcSet: "t.avif 320w" });
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
