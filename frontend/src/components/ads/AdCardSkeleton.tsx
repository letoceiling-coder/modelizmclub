import { Skeleton } from "@/components/ui/skeleton";

export function AdCardSkeleton() {
  return (
    <div
      className="grid items-stretch gap-[10px] p-[10px] grid-cols-[80px_minmax(0,1fr)_auto] sm:grid-cols-[96px_minmax(0,1fr)_auto] sm:gap-[12px] sm:p-[12px]"
      style={{
        background: "var(--background-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Thumbnail — square, matches ListingCard */}
      <Skeleton className="w-[80px] h-[80px] sm:w-[96px] sm:h-[96px] shrink-0" style={{ borderRadius: "var(--r-card-sm)" }} />

      {/* Body */}
      <div className="flex flex-col justify-between gap-[8px] py-[2px]">
        <div className="space-y-[8px]">
          <Skeleton className="h-[14px] w-[80%]" />
          <Skeleton className="h-[14px] w-[55%]" />
          <Skeleton className="h-[19px] w-[40%]" />
        </div>
        <Skeleton className="h-[10px] w-[65%]" />
      </div>

      {/* Right: status badge + action button */}
      <div className="flex flex-col items-end justify-between gap-[6px]">
        <Skeleton className="h-[20px] w-[72px]" style={{ borderRadius: 6 }} />
        <Skeleton className="h-[32px] w-[32px]" style={{ borderRadius: 9999 }} />
      </div>
    </div>
  );
}
