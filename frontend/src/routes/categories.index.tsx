import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { CategoryCard } from "@/components/CategoryCard";
import { categories } from "@/lib/mock";

export const Route = createFileRoute("/categories/")({
  head: () => ({ meta: [{ title: "Категории — МоДелизМ Форум" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-4">
        <header>
          <h1 className="font-display text-2xl font-bold">Категории</h1>
          <p
            className="mt-[2px] font-display text-[15px] font-semibold"
            style={{ color: "var(--accent)" }}
          >
            Найди своих
          </p>
          <p className="mt-[4px] text-sm text-muted-foreground">Выберите интересующее вас направление</p>
        </header>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {categories.map((c) => <CategoryCard key={c.id} c={c} />)}
        </div>
      </div>
    </AppLayout>
  );
}
