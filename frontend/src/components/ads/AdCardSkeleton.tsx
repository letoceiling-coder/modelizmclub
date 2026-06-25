import { SkeletonBox } from "@/components/feed/Skeleton";

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
      <div style={{ aspectRatio: "4 / 3" }}>
        <SkeletonBox w="100%" h="100%" radius={0} />
      </div>
      <div className="space-y-[10px] p-[16px]">
        <SkeletonBox w="85%" h={14} />
        <SkeletonBox w="40%" h={22} />
        <SkeletonBox w="60%" h={11} />
        <SkeletonBox w="70%" h={11} />
      </div>
    </div>
  );
}
