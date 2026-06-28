import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { CategoryCard } from "@/components/CategoryCard";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { showcaseImages } from "@/lib/showcase-images";

export const Route = createFileRoute("/categories/")({
  head: () => ({ meta: [{ title: "Категории — МоДелизМ Форум" }] }),
  component: CategoriesPage,
});

function CategoriesPage() {
  const categories = usePostCategories();
  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-5">
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

        {/* 3D showcase strip */}
        <section className="space-y-3 pt-2">
          <div className="flex items-end justify-between">
            <h2 className="font-display text-lg font-bold">Популярные модели</h2>
            <span className="text-xs" style={{ color: "var(--foreground-50)" }}>
              {showcaseImages.length} моделей
            </span>
          </div>
          <div className="-mx-2 flex snap-x snap-mandatory gap-3 overflow-x-auto px-2 pb-2">
            {showcaseImages.map((s) => (
              <div
                key={s.url}
                className="relative shrink-0 snap-start overflow-hidden"
                style={{
                  width: 152,
                  aspectRatio: "1 / 1",
                  background: "linear-gradient(135deg, var(--background-surface) 0%, var(--background) 100%)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-card)",
                }}
              >
                <img
                  src={s.url}
                  alt={s.title}
                  loading="lazy"
                  className="absolute inset-0 h-full w-full object-contain p-2"
                />
                <div
                  className="absolute inset-x-1.5 bottom-1.5 rounded-md px-2 py-1 text-[10.5px] font-semibold"
                  style={{
                    background: "color-mix(in oklab, var(--background) 80%, transparent)",
                    backdropFilter: "blur(6px)",
                    color: "var(--foreground)",
                  }}
                >
                  {s.tag}
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </AppLayout>
  );
}
