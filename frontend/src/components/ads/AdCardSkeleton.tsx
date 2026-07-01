import { Skeleton } from "@/components/ui/skeleton";

export function AdCardSkeleton() {
  return (
    <div
      className="overflow-hidden"
      style={{
        background: "var(--background-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <Skeleton className="w-full" style={{ aspectRatio: "4 / 3", borderRadius: 0 }} />
      <div className="space-y-[10px] p-[16px]">
        <Skeleton className="h-[14px] w-[85%]" />
        <Skeleton className="h-[22px] w-[40%]" />
        <Skeleton className="h-[11px] w-[60%]" />
        <Skeleton className="h-[11px] w-[70%]" />
      </div>
    </div>
  );
}
