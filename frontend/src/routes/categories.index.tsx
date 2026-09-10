import { createFileRoute } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { CategoryCard } from "@/components/CategoryCard";
import { usePostCategories } from "@/lib/hooks/useCategories";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/categories/")({
  head: () => ({ meta: [{ title: i18n.t("pages.categories.metaTitle") }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const { t } = useTranslation();
  const categories = usePostCategories();
  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-5">
        <header>
          <h1 className="font-display text-2xl font-bold">{t("pages.categories.title")}</h1>
          <p
            className="mt-[2px] font-display text-[15px] font-semibold"
            style={{ color: "var(--accent)" }}
          >
            {t("pages.categories.accent")}
          </p>
          <p className="mt-[4px] text-sm text-muted-foreground">{t("pages.categories.subtitle")}</p>
        </header>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => (
            <CategoryCard key={c.id} c={c} />
          ))}
        </div>
      </div>
    </AppLayout>
  );
}
