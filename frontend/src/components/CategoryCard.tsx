import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Category } from "@/lib/mock";
import { CategoryIcon, IconBox } from "@/components/ui/Icon";

export function CategoryCard({ c }: { c: Category }) {
  const { t } = useTranslation();
  return (
    <Link
      to="/categories/$id"
      params={{ id: c.id }}
      className="group flex flex-col rounded-xl border bg-card p-4 transition hover:border-[var(--neutral-400)] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      aria-label={t("pages.categories.openCategory", { name: c.name })}
    >
      <div className="flex items-center gap-3">
        <IconBox
          size="md"
          variant="elevated"
          className="h-11 w-11 shrink-0"
        >
          <CategoryIcon categoryId={c.id} name={c.icon} iconImageUrl={c.iconImageUrl} fill />
        </IconBox>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold">{c.name}</h3>
          <p className="text-xs text-muted-foreground">{t("pages.categories.members", { count: c.members.toLocaleString(), rooms: c.subcategories.length })}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{c.description}</p>
      <span className="mt-3 inline-flex w-fit items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground group-hover:opacity-90">
        {t("pages.categories.open")}
      </span>
    </Link>
  );
}
