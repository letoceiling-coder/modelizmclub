import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { AppLayout } from "@/components/layout/AppLayout";
import { Skeleton } from "@/components/ui/skeleton";
import { PostCardSkeleton } from "@/components/feed/Skeleton";
import { CatalogCardSkeleton } from "@/components/ads/CatalogCardSkeleton";

const fade = {
  initial: { opacity: 0.45 },
  animate: { opacity: 1 },
  transition: { duration: 0.28, ease: [0.22, 1, 0.36, 1] as const },
};

function Fade({ children }: { children: ReactNode }) {
  return (
    <motion.div {...fade} role="status" aria-busy="true" aria-live="polite">
      {children}
    </motion.div>
  );
}

export function FeedPageSkeleton() {
  return (
    <AppLayout>
      <Fade>
        <div className="space-y-[12px]">
          <div className="flex gap-[8px]">
            <Skeleton className="h-[36px] w-[72px] rounded-full" />
            <Skeleton className="h-[36px] w-[96px] rounded-full" />
            <Skeleton className="h-[36px] w-[88px] rounded-full" />
          </div>
          <PostCardSkeleton />
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      </Fade>
    </AppLayout>
  );
}

export function AdsPageSkeleton() {
  return (
    <AppLayout>
      <Fade>
        <div className="mb-[14px] flex items-center justify-between gap-[12px]">
          <Skeleton className="h-[22px] w-[140px] rounded-[8px]" />
          <Skeleton className="h-[36px] w-[120px] rounded-[10px]" />
        </div>
        <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <CatalogCardSkeleton key={i} />
          ))}
        </div>
      </Fade>
    </AppLayout>
  );
}

export function DealsPageSkeleton() {
  return (
    <AppLayout rightColumn={false}>
      <Fade>
        <div className="mx-auto w-full max-w-[760px] space-y-[12px]">
          <Skeleton className="h-[28px] w-[240px] rounded-[8px]" />
          <Skeleton className="h-[16px] w-[80%] rounded-[6px]" />
          <Skeleton className="h-[40px] w-[220px] rounded-full" />
          {Array.from({ length: 4 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-[14px] p-[16px]"
              style={{ border: "1px solid var(--border)", borderRadius: "var(--r-card)", background: "var(--background-elevated)" }}
            >
              <Skeleton className="h-[40px] w-[40px] shrink-0 rounded-full" />
              <div className="min-w-0 flex-1 space-y-[8px]">
                <Skeleton className="h-[15px] w-[55%] rounded-[6px]" />
                <Skeleton className="h-[12px] w-[35%] rounded-[6px]" />
              </div>
              <Skeleton className="h-[24px] w-[88px] rounded-full" />
            </div>
          ))}
        </div>
      </Fade>
    </AppLayout>
  );
}

export function MessengerPageSkeleton() {
  return (
    <AppLayout rightColumn={false}>
      <Fade>
        <div className="flex min-h-[60vh] overflow-hidden rounded-[var(--r-card)]" style={{ border: "1px solid var(--border)" }}>
          <div className="hidden w-[320px] shrink-0 flex-col sm:flex" style={{ borderRight: "1px solid var(--border)" }}>
            <div className="p-[14px]"><Skeleton className="h-[36px] w-full rounded-[10px]" /></div>
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="flex items-center gap-[12px] px-[16px] py-[12px]" style={{ borderTop: "1px solid var(--border)" }}>
                <Skeleton className="h-[48px] w-[48px] shrink-0 rounded-full" />
                <div className="min-w-0 flex-1 space-y-[8px]">
                  <Skeleton className="h-[12px] w-[60%] rounded-[6px]" />
                  <Skeleton className="h-[11px] w-[80%] rounded-[6px]" />
                </div>
              </div>
            ))}
          </div>
          <div className="flex min-w-0 flex-1 flex-col p-[16px]">
            <div className="flex items-center gap-[12px] pb-[16px]" style={{ borderBottom: "1px solid var(--border)" }}>
              <Skeleton className="h-[40px] w-[40px] shrink-0 rounded-full" />
              <Skeleton className="h-[14px] w-[140px] rounded-[6px]" />
            </div>
            <div className="mt-auto space-y-[10px] pt-[24px]">
              <Skeleton className="ml-auto h-[40px] w-[55%] rounded-[14px]" />
              <Skeleton className="h-[40px] w-[45%] rounded-[14px]" />
              <Skeleton className="ml-auto h-[40px] w-[40%] rounded-[14px]" />
            </div>
            <Skeleton className="mt-[16px] h-[44px] w-full rounded-[12px]" />
          </div>
        </div>
      </Fade>
    </AppLayout>
  );
}

export function ProfilePageSkeleton() {
  return (
    <AppLayout>
      <Fade>
        <div className="overflow-hidden" style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: "var(--r-card)" }}>
          <Skeleton className="h-[140px] w-full rounded-none md:h-[180px]" />
          <div className="flex flex-col gap-[12px] px-[16px] pb-[16px] md:flex-row md:items-end md:px-[32px]" style={{ marginTop: -44 }}>
            <Skeleton className="h-[88px] w-[88px] shrink-0 rounded-full md:h-[112px] md:w-[112px]" />
            <div className="min-w-0 flex-1 space-y-[8px] pb-[8px]">
              <Skeleton className="h-[22px] w-[42%] rounded-[8px]" />
              <Skeleton className="h-[13px] w-[28%] rounded-[6px]" />
            </div>
            <Skeleton className="h-[40px] w-full rounded-[10px] md:w-[160px]" />
          </div>
          <div className="flex gap-[8px] px-[16px] pb-[12px] md:px-[32px]">
            <Skeleton className="h-[32px] w-[90px] rounded-full" />
            <Skeleton className="h-[32px] w-[110px] rounded-full" />
            <Skeleton className="h-[32px] w-[100px] rounded-full" />
          </div>
        </div>
        <div className="mt-[16px] space-y-[12px]">
          <PostCardSkeleton />
          <PostCardSkeleton />
        </div>
      </Fade>
    </AppLayout>
  );
}
