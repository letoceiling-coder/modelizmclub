import { Skeleton } from "@/components/ui/skeleton";

/**
 * Matches {@link CatalogCard} layout so the catalog grid keeps stable height while loading.
 *
 * Строки заглушки стоят внутри тех же текстовых классов, что и у карточки:
 * высоту каждой задаёт интерлиньяж класса (24 / 2 × 19,6 / 15,6), а не
 * число на глаз, — поэтому заглушка и карточка совпадают до пикселя.
 */
export function CatalogCardSkeleton() {
  return (
    <div
      className="flex flex-col overflow-hidden"
      style={{
        borderRadius: "var(--r-card)",
        border: "1px solid var(--border)",
        background: "var(--background-elevated)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <Skeleton className="aspect-[4/3] w-full shrink-0 rounded-none" />
      <div className="flex flex-col p-[8px]">
        <div className="text-body">
          <Skeleton className="inline-block h-[0.8em] w-[45%] align-middle" />
        </div>
        <div className="mt-[4px] text-meta">
          <Skeleton className="inline-block h-[0.8em] w-[92%] align-middle" />
          <br />
          <Skeleton className="inline-block h-[0.8em] w-[72%] align-middle" />
        </div>
        <div className="text-caption">
          <Skeleton className="inline-block h-[0.8em] w-[58%] align-middle" />
        </div>
      </div>
    </div>
  );
}
