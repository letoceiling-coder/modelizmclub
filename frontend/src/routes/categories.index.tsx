import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CategoryCard } from "@/components/CategoryCard";
import type { Category } from "@/lib/types";
import { fetchListingCategories } from "@/lib/api/catalog";

export const Route = createFileRoute("/categories/")({
  head: () => ({ meta: [{ title: tStatic("categories.metaTitle") }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetchListingCategories().then((items) => {
      setCategories(items);
      setLoading(false);
    });
  }, []);

  return (
    <AppLayout>
      <div className="space-y-6">
        <header>
          <h1 className="font-display text-[28px] font-bold">{t("nav.categories")}</h1>
          <p className="mt-1 text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("categories.subtitle")}</p>
        </header>
        {loading ? (
          <div className="py-20 text-center">{t("common.loading")}</div>
        ) : categories.length === 0 ? (
          <div className="py-20 text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("categories.empty")}</div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {categories.map((c) => <CategoryCard key={c.id} c={c} />)}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
