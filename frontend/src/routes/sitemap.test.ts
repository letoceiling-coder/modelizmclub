import { describe, expect, it, vi } from "vitest";

vi.mock("@tanstack/react-router", () => ({ createFileRoute: () => (opts: unknown) => opts }));

const { buildSitemapXml } = await import("./sitemap[.]xml");

describe("sitemap.xml", () => {
  it("без ответа API отдаёт разделы, а не пустоту или ошибку", async () => {
    const xml = await buildSitemapXml(null);
    expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>')).toBe(true);
    expect(xml).toContain("<loc>https://modelizmclub.ru/ads</loc>");
    expect(xml).toContain("<loc>https://modelizmclub.ru/rules/tariffs</loc>");
    expect(xml).not.toContain("/settings");
  });

  it("ведёт на страницы сущностей теми путями, что у маршрутов, и экранирует адреса", async () => {
    const xml = await buildSitemapXml({
      listings: [{ uuid: "3ed80234-a3fa-4ecd-9592-417d3956e042", lastmod: "2026-09-13" }],
      communities: [{ slug: "flot&parus", lastmod: null }],
      channels: [{ slug: "modelizm", lastmod: "2026-07-24" }],
    });
    expect(xml).toContain(
      "<url><loc>https://modelizmclub.ru/ads/3ed80234-a3fa-4ecd-9592-417d3956e042</loc><lastmod>2026-09-13</lastmod>",
    );
    expect(xml).toContain("<loc>https://modelizmclub.ru/communities/flot%26parus</loc>");
    expect(xml).toContain("<loc>https://modelizmclub.ru/channel/modelizm</loc>");
    expect(xml).not.toMatch(/&(?!amp;|lt;|gt;|quot;|apos;)/);
  });
});
