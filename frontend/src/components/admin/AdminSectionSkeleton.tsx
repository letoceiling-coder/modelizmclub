import { Skeleton } from "@/components/ui/skeleton";

/** Fallback shown while a lazily-loaded admin section chunk is fetched. */
export function AdminSectionSkeleton() {
  return (
    <div>
      <Skeleton className="h-[28px] w-[220px]" style={{ marginBottom: "16px" }} />
      <div
        className="grid grid-cols-2 lg:grid-cols-4"
        style={{ gap: "12px", marginBottom: "20px" }}
      >
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-[90px]" />
        ))}
      </div>
      <Skeleton className="h-[240px]" />
    </div>
  );
}
