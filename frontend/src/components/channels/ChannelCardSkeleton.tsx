import { Skeleton } from "@/components/ui/skeleton";

/** Matches ChannelCard / MyChannelCard footprint to avoid layout shift while loading. */
export function ChannelCardSkeleton() {
  return (
    <li>
      <div
        className="flex h-full min-h-[168px] flex-col gap-3 p-4"
        style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--r-card)" }}
      >
        <div className="grid grid-cols-[auto_minmax(0,1fr)] items-start gap-3">
          <Skeleton className="h-12 w-12 shrink-0 rounded-[12px]" />
          <div className="min-w-0 space-y-2">
            <Skeleton className="h-[15px] w-[72%] rounded-[6px]" />
            <Skeleton className="h-[13px] w-full rounded-[6px]" />
            <Skeleton className="h-[13px] w-[88%] rounded-[6px]" />
            <div className="flex flex-wrap gap-1.5 pt-1">
              <Skeleton className="h-[22px] w-[64px] rounded-[6px]" />
              <Skeleton className="h-[22px] w-[72px] rounded-[6px]" />
            </div>
          </div>
        </div>
        <Skeleton className="mt-auto h-9 w-full rounded-[10px]" />
      </div>
    </li>
  );
}

export function ChannelsPageSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="space-y-[28px]">
      {[0, 1].map((section) => (
        <section key={section} className="space-y-[14px]">
          <div className="flex items-end justify-between gap-[12px]">
            <Skeleton className="h-[24px] w-[180px] rounded-[6px]" />
          </div>
          <ul className="grid list-none gap-3 sm:grid-cols-2">
            {Array.from({ length: count }, (_, i) => (
              <ChannelCardSkeleton key={`${section}-${i}`} />
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
