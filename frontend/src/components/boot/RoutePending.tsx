import { AppLayout } from "@/components/layout/AppLayout";
import { AppBootPreload } from "@/components/boot/AppBootPreload";
import { Skeleton } from "@/components/ui/skeleton";
import { hasBooted } from "@/lib/boot/bootState";

/** Content-shaped placeholder: same paddings, radii and heights as a real page,
 *  so swapping it for the loaded content costs no layout shift. */
export function PageSkeleton() {
  return (
    <div className="space-y-[12px]" role="status" aria-busy="true" aria-live="polite">
      <div
        className="rounded-[var(--r-card)] border p-[16px]"
        style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
      >
        <Skeleton className="h-[20px] w-[46%] rounded-[8px]" />
        <Skeleton className="mt-[10px] h-[14px] w-[70%] rounded-[6px]" />
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-[var(--r-card)] border p-[16px]"
          style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
        >
          <div className="flex items-center gap-[12px]">
            <Skeleton className="h-[40px] w-[40px] shrink-0 rounded-full" />
            <div className="min-w-0 flex-1 space-y-[8px]">
              <Skeleton className="h-[13px] w-[38%] rounded-[6px]" />
              <Skeleton className="h-[11px] w-[24%] rounded-[6px]" />
            </div>
          </div>
          <Skeleton className="mt-[14px] h-[13px] w-full rounded-[6px]" />
          <Skeleton className="mt-[8px] h-[13px] w-[82%] rounded-[6px]" />
          <Skeleton className="mt-[14px] rounded-[12px]" style={{ aspectRatio: "16 / 9" }} />
        </div>
      ))}
    </div>
  );
}

/** Cold start gets the branded full-viewport preload; in-app navigation keeps
 *  the shell mounted and only skeletons the centre column, so the header,
 *  sidebar and right rail never blink. */
export function RoutePending() {
  if (!hasBooted()) return <AppBootPreload />;
  return (
    <AppLayout>
      <PageSkeleton />
    </AppLayout>
  );
}
