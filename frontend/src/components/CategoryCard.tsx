import { useTranslation } from "@/lib/i18n";
import { Link } from "@tanstack/react-router";
import * as Icons from "lucide-react";
import { ChevronRight } from "lucide-react";
import type { Category } from "@/lib/mock";

export function CategoryCard({ c }: { c: Category }) {
  const { t } = useTranslation();
  const Icon = (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[c.icon] ?? Icons.Box;
  return (
    <Link
      to="/categories/$id"
      params={{ id: c.id }}
      className="group flex flex-col rounded-xl border bg-card p-4 transition-all hover:border-[var(--accent)] hover:shadow-md focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
      aria-label={t("components.categoryCardOpenAria", { name: c.name })}
    >
      <div className="flex items-center gap-3">
        <div className="grid h-11 w-11 place-items-center rounded-lg bg-accent text-primary">
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold">{c.name}</h3>
          <p className="text-xs text-muted-foreground">{t("components.categoryCardMembersRooms", { members: c.members.toLocaleString("ru"), rooms: c.subcategories.length })}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </div>
      <p className="mt-3 text-sm text-muted-foreground">{c.description}</p>
      <span className="mt-3 inline-flex w-fit items-center rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground group-hover:opacity-90">{t("components.categoryCardOpen")}</span>
    </Link>
  );
}
