import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { AdCard } from "@/components/AdCard";
import type { Category, Ad } from "@/lib/types";
import { fetchListingCategories } from "@/lib/api/catalog";
import { fetchListings } from "@/lib/api/listings";

export const Route = createFileRoute("/categories/$id/$subId")({
  head: () => ({ meta: [{ title: tStatic("categories.metaTitle") }] }),
  component: SubcategoryPage,
});

function SubcategoryPage() {
  const { t } = useTranslation();
  const { id, subId } = Route.useParams();
  const [categories, setCategories] = useState<Category[]>([]);
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const cats = await fetchListingCategories();
        if (cancelled) return;
        setCategories(cats);
        const cat = cats.find((c) => c.id === id || c.slug === id);
        const sub = cat?.subcategories?.find((s) => s.id === subId || s.slug === subId);
        const listings = await fetchListings({
          category_id: cat ? Number(cat.id) : undefined,
          subcategory_id: sub ? Number(sub.id) : undefined,
        });
        if (!cancelled) setAds(listings);
      } catch {
        if (!cancelled) setAds([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [id, subId]);

  const category = useMemo(() => categories.find((c) => c.id === id || c.slug === id), [categories, id]);
  const subcategory = useMemo(
    () => category?.subcategories?.find((s) => s.id === subId || s.slug === subId),
    [category, subId],
  );

  return (
    <AppLayout>
      <div className="space-y-6">
        <header>
          <Link to="/categories/$id" params={{ id }} className="text-[12px] font-semibold" style={{ color: "var(--accent)" }}>
            ← {category?.name ?? t("nav.categories")}
          </Link>
          <h1 className="mt-1 font-display text-[28px] font-bold">{subcategory?.name ?? t("nav.categories")}</h1>
        </header>
        {loading ? (
          <div className="py-20 text-center">{t("common.loading")}</div>
        ) : ads.length === 0 ? (
          <div className="py-20 text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("categories.subcategoryEmpty")}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {ads.map((ad) => <AdCard key={ad.id} ad={ad} />)}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
