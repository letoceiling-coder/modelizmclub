import { createFileRoute } from "@tanstack/react-router";
import { API_BASE_URL } from "@/lib/api/client";

/*
 * /sitemap.xml — карта для поисковиков.
 *
 * Разделы перечислены здесь, сущности приходят из `/api/v1/public/sitemap`
 * (опубликованные объявления, активные сообщества, включённые каналы — только
 * то, что гость откроет без входа). Профилей и обзоров нет намеренно: у
 * профиля настройки приватности, обзоры закрыты подпиской.
 *
 * Карта собирается раз в час на процесс. Если API не ответил, отдаём разделы
 * без сущностей, а не 500: поисковик, получивший ошибку, перестаёт ходить за
 * картой, а неполная карта ничего не ломает.
 */

const ORIGIN = "https://modelizmclub.ru";
const TTL_MS = 60 * 60 * 1000;

/** Разделы, открытые гостю. Закрытые — в robots.txt. */
const SECTIONS: ReadonlyArray<{ path: string; changefreq: string; priority: string }> = [
  { path: "/", changefreq: "daily", priority: "1.0" },
  { path: "/feed", changefreq: "hourly", priority: "0.9" },
  { path: "/ads", changefreq: "hourly", priority: "0.9" },
  { path: "/communities", changefreq: "daily", priority: "0.8" },
  { path: "/channels", changefreq: "daily", priority: "0.8" },
  { path: "/how-it-works", changefreq: "monthly", priority: "0.5" },
  { path: "/rules", changefreq: "monthly", priority: "0.4" },
  { path: "/rules/tariffs", changefreq: "monthly", priority: "0.5" },
  { path: "/rules/safe-deal", changefreq: "monthly", priority: "0.5" },
  { path: "/payment", changefreq: "monthly", priority: "0.4" },
  { path: "/refund", changefreq: "monthly", priority: "0.4" },
  { path: "/legal/rules", changefreq: "monthly", priority: "0.3" },
  { path: "/legal/privacy", changefreq: "monthly", priority: "0.3" },
  { path: "/legal/consent", changefreq: "monthly", priority: "0.3" },
  { path: "/legal/compliance", changefreq: "monthly", priority: "0.3" },
  { path: "/info/feedback", changefreq: "monthly", priority: "0.3" },
  { path: "/info/security", changefreq: "monthly", priority: "0.3" },
];

interface SitemapEntities {
  listings: Array<{ uuid: string; lastmod: string | null }>;
  communities: Array<{ slug: string; lastmod: string | null }>;
  channels: Array<{ slug: string; lastmod: string | null }>;
}

let cached: { xml: string; at: number } | null = null;

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function url(
  path: string,
  extra: { lastmod?: string | null; changefreq?: string; priority?: string },
): string {
  const parts = [`<loc>${escapeXml(ORIGIN + path)}</loc>`];
  if (extra.lastmod) parts.push(`<lastmod>${escapeXml(extra.lastmod)}</lastmod>`);
  if (extra.changefreq) parts.push(`<changefreq>${extra.changefreq}</changefreq>`);
  if (extra.priority) parts.push(`<priority>${extra.priority}</priority>`);
  return `<url>${parts.join("")}</url>`;
}

async function loadEntities(): Promise<SitemapEntities | null> {
  try {
    const res = await fetch(`${API_BASE_URL}/public/sitemap`, {
      headers: { Accept: "application/json" },
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) return null;
    const body = (await res.json()) as { data?: SitemapEntities };
    return body.data ?? null;
  } catch {
    return null;
  }
}

export async function buildSitemapXml(entities: SitemapEntities | null): Promise<string> {
  const rows = SECTIONS.map((s) => url(s.path, { changefreq: s.changefreq, priority: s.priority }));
  if (entities) {
    for (const l of entities.listings)
      rows.push(url(`/ads/${encodeURIComponent(l.uuid)}`, { lastmod: l.lastmod, priority: "0.7" }));
    for (const c of entities.communities)
      rows.push(
        url(`/communities/${encodeURIComponent(c.slug)}`, { lastmod: c.lastmod, priority: "0.6" }),
      );
    for (const c of entities.channels)
      rows.push(
        url(`/channel/${encodeURIComponent(c.slug)}`, { lastmod: c.lastmod, priority: "0.6" }),
      );
  }
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join("\n")}\n</urlset>\n`;
}

export const Route = createFileRoute("/sitemap.xml")({
  server: {
    handlers: {
      GET: async () => {
        const now = Date.now();
        if (!cached || now - cached.at > TTL_MS) {
          const entities = await loadEntities();
          const xml = await buildSitemapXml(entities);
          // Неполную карту (API не ответил) не кешируем на час — повторим на следующем запросе.
          cached = entities ? { xml, at: now } : null;
          return xmlResponse(xml);
        }
        return xmlResponse(cached.xml);
      },
    },
  },
});

function xmlResponse(xml: string): Response {
  return new Response(xml, {
    headers: {
      "Content-Type": "application/xml; charset=utf-8",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
