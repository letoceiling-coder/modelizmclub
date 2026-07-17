import { Skeleton } from "@/components/ui/skeleton";

/** Matches {@link CatalogCard} layout so the catalog grid keeps stable height while loading. */
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
      <div className="flex flex-col gap-[8px] p-[10px] sm:p-[12px]">
        <Skeleton className="h-[20px] w-[45%]" />
        <Skeleton className="h-[14px] w-[92%]" />
        <Skeleton className="h-[14px] w-[72%]" />
        <Skeleton className="mt-[4px] h-[11px] w-[58%]" />
      </div>
    </div>
  );
}
