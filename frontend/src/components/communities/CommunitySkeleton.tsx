import { Skeleton } from "@/components/ui/skeleton";

/** Matches CommunityCard: cover 120px + overlapping avatar + body. */
export function CommunitySkeleton() {
  return (
    <div
      className="overflow-hidden flex flex-col"
      style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 16 }}
    >
      <Skeleton className="h-[120px] w-full rounded-none" />
      <div className="relative px-4 pb-4 pt-8">
        <Skeleton className="absolute -top-7 left-4 h-14 w-14 rounded-[12px]" />
        <Skeleton className="h-[16px] w-[70%] rounded-[6px]" />
        <Skeleton className="mt-2 h-[13px] w-full rounded-[6px]" />
        <Skeleton className="mt-1.5 h-[13px] w-[88%] rounded-[6px]" />
        <Skeleton className="mt-4 h-9 w-full rounded-[10px]" />
      </div>
    </div>
  );
}

export function CommunitiesPageSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-[28px]">
      {[0, 1].map((section) => (
        <section key={section} className="space-y-[14px]">
          <Skeleton className="h-[24px] w-[200px] rounded-[6px]" />
          <div className="grid gap-[16px] grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
            {Array.from({ length: count }, (_, i) => (
              <CommunitySkeleton key={`${section}-${i}`} />
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
