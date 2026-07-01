import { Skeleton } from "@/components/ui/skeleton";

/** Loading placeholder for /ads/:id — mirrors the gallery + sticky panel
 *  layout so there is no shift when the real content arrives. */
export function AdDetailSkeleton() {
  return (
    <div className="mx-auto flex max-w-[1100px] flex-col gap-[24px]">
      {/* Breadcrumb */}
      <Skeleton className="h-[14px] w-[200px]" />

      <div className="grid gap-[24px] lg:grid-cols-[1fr_360px]">
        {/* Gallery */}
        <div className="min-w-0 flex flex-col gap-[12px]">
          <Skeleton className="w-full" style={{ aspectRatio: "4 / 3", borderRadius: "var(--r-card)" }} />
          <div className="flex gap-[8px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} style={{ flex: "0 0 88px", height: 66, borderRadius: "var(--r-card-sm)" }} />
            ))}
          </div>
        </div>

        {/* Panel */}
        <div
          className="flex flex-col gap-[16px] p-[20px]"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <Skeleton className="h-[24px] w-[80px]" style={{ borderRadius: "var(--r-pill)" }} />
          <div className="space-y-[8px]">
            <Skeleton className="h-[22px] w-[90%]" />
            <Skeleton className="h-[22px] w-[60%]" />
          </div>
          <Skeleton className="h-[34px] w-[45%]" />
          <Skeleton className="h-[14px] w-[75%]" />
          <div className="flex flex-col gap-[8px]">
            <Skeleton className="h-[44px] w-full" style={{ borderRadius: "var(--r-button)" }} />
            <div className="grid grid-cols-2 gap-[8px]">
              <Skeleton className="h-[40px]" style={{ borderRadius: "var(--r-button)" }} />
              <Skeleton className="h-[40px]" style={{ borderRadius: "var(--r-button)" }} />
            </div>
          </div>
        </div>
      </div>

      {/* Description card */}
      <div
        className="p-[24px]"
        style={{
          background: "var(--background-elevated)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-card)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <Skeleton className="h-[18px] w-[140px]" />
        <div className="mt-[14px] space-y-[8px]">
          <Skeleton className="h-[14px] w-full" />
          <Skeleton className="h-[14px] w-[92%]" />
          <Skeleton className="h-[14px] w-[80%]" />
        </div>
      </div>
    </div>
  );
}
