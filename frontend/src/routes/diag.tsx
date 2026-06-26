import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchPostCategories } from "@/lib/api/catalog";
import { fetchCommunities } from "@/lib/api/communities";
import { fetchListings } from "@/lib/api/listings";
import { fetchFeed } from "@/lib/api/feed";
import { fetchFaq, fetchPublicStats } from "@/lib/api/public";

export const Route = createFileRoute("/diag")({
  head: () => ({ meta: [{ title: tStatic("diag.metaTitle") }] }),
  component: DiagPage,
});

type Check = { name: string; ok: boolean; count?: number };

function DiagPage() {
  const { t } = useTranslation();
  const [checks, setChecks] = useState<Check[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const results: Check[] = [];
      try {
        const cats = await fetchPostCategories();
        results.push({ name: "POST categories", ok: true, count: cats.length });
      } catch {
        results.push({ name: "POST categories", ok: false });
      }
      try {
        const comm = await fetchCommunities({ per_page: 5 });
        results.push({ name: "Communities", ok: true, count: comm.length });
      } catch {
        results.push({ name: "Communities", ok: false });
      }
      try {
        const listings = await fetchListings({ per_page: 5 });
        results.push({ name: "Listings", ok: true, count: listings.length });
      } catch {
        results.push({ name: "Listings", ok: false });
      }
      try {
        const feed = await fetchFeed({ per_page: 5 });
        results.push({ name: "Feed", ok: !feed.error, count: feed.posts.length });
      } catch {
        results.push({ name: "Feed", ok: false });
      }
      try {
        const faq = await fetchFaq();
        results.push({ name: "FAQ", ok: true, count: faq.length });
      } catch {
        results.push({ name: "FAQ", ok: false });
      }
      try {
        await fetchPublicStats();
        results.push({ name: "Public stats", ok: true });
      } catch {
        results.push({ name: "Public stats", ok: false });
      }
      setChecks(results);
      setLoading(false);
    })();
  }, []);

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto max-w-[640px] space-y-4">
        <h1 className="font-display text-[24px] font-bold">{t("diag.title")}</h1>
        {loading ? (
          <p>{t("common.loading")}</p>
        ) : (
          <ul className="space-y-2">
            {checks.map((c) => (
              <li key={c.name} className="flex items-center justify-between rounded-xl border px-4 py-3" style={{ borderColor: "var(--border)" }}>
                <span>{c.name}</span>
                <span style={{ color: c.ok ? "var(--success)" : "var(--error)" }}>
                  {c.ok ? `OK${c.count != null ? ` (${c.count})` : ""}` : "FAIL"}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </AppLayout>
  );
}
