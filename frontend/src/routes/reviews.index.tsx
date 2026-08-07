import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, SearchX } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Video, VideoCategory } from "@/lib/mock";
import { fetchVideos, fetchVideoCategories } from "@/lib/api/reviews";
import { VideoCard } from "@/components/reviews/VideoCard";
import { ReviewsHero } from "@/components/reviews/ReviewsHero";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/reviews/")({
  head: () => ({ meta: [{ title: i18n.t("pages.reviews.metaTitle") }] }),
  validateSearch: (search: Record<string, unknown>) => ({
    category: typeof search.category === "string" ? search.category : undefined,
    q: typeof search.q === "string" ? search.q : undefined,
  }),
  component: ReviewsPage,
});

const ALL = "all";
const SKELETON_COUNT = 8;

function VideoCardSkeleton() {
  return (
    <div className="flex flex-col">
      <Skeleton className="w-full rounded-[var(--r-card)]" style={{ aspectRatio: "16 / 9" }} />
      <Skeleton className="mt-[8px] h-[14px] w-[92%] rounded-[6px]" />
      <Skeleton className="mt-[6px] h-[14px] w-[65%] rounded-[6px]" />
      <Skeleton className="mt-[6px] h-[11px] w-[45%] rounded-[6px]" />
    </div>
  );
}

function VideoGridSkeleton({ count = SKELETON_COUNT }: { count?: number }) {
  return (
    <div className="grid grid-cols-2 gap-[16px] sm:grid-cols-3 lg:grid-cols-4">
      {Array.from({ length: count }, (_, i) => (
        <VideoCardSkeleton key={i} />
      ))}
    </div>
  );
}

function ReviewsPage() {
  const { t } = useTranslation();
  const { category: categoryFromUrl, q: qFromUrl } = Route.useSearch();
  const [videos, setVideos] = useState<Video[]>([]);
  const [featured, setFeatured] = useState<Video[]>([]);
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [activeCat, setActiveCat] = useState<string>(categoryFromUrl ?? ALL);
  const [query, setQuery] = useState(qFromUrl ?? "");
  const [initialLoading, setInitialLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const hasLoadedOnceRef = useRef(false);

  const tabs = useMemo(() => {
    const sorted = [...categories].sort(
      (a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || (a.name ?? "").localeCompare(b.name ?? "", "ru"),
    );
    return [{ id: ALL, name: t("pages.reviews.allCategory"), slug: ALL }, ...sorted];
  }, [categories, t]);

  const sectionTitle = useMemo(() => {
    if (query) return t("pages.reviews.searchResults");
    if (activeCat === ALL) return t("pages.reviews.allReviews");
    const cat = categories.find((c) => c.slug === activeCat);
    return cat?.name ? t("pages.reviews.categoryReviews", { name: cat.name }) : t("pages.reviews.allReviews");
  }, [query, activeCat, categories, t]);

  useEffect(() => {
    if (categoryFromUrl) setActiveCat(categoryFromUrl);
    if (typeof qFromUrl === "string") setQuery(qFromUrl);
  }, [categoryFromUrl, qFromUrl]);

  useEffect(() => {
    let alive = true;
    Promise.all([fetchVideoCategories(), fetchVideos({ featured: true })])
      .then(([cats, feat]) => {
        if (!alive) return;
        setCategories(cats);
        setFeatured(feat);
      })
      .catch(() => {});
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    let alive = true;
    const isInitial = !hasLoadedOnceRef.current;
    if (isInitial) setInitialLoading(true);
    else setRefreshing(true);

    fetchVideos({ q: query || undefined, categorySlug: activeCat })
      .then((list) => {
        if (alive) setVideos(list);
      })
      .catch(() => {})
      .finally(() => {
        if (!alive) return;
        setInitialLoading(false);
        setRefreshing(false);
        hasLoadedOnceRef.current = true;
      });
    return () => { alive = false; };
  }, [query, activeCat]);

  const newest = videos.slice(0, 10);

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[1200px] flex-col gap-[20px]">
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder={t("pages.reviews.searchPlaceholder")}
          aria-label={t("pages.reviews.searchAria")}
        />

        <div className="-mx-[16px] flex gap-[8px] overflow-x-auto px-[16px] pb-[4px] sm:mx-0 sm:px-0 no-scrollbar">
          {tabs.map((c) => {
            const active = activeCat === c.slug;
            return (
              <button
                key={c.id}
                type="button"
                onClick={() => setActiveCat(c.slug)}
                className="shrink-0 whitespace-nowrap px-[14px] text-[13px] font-medium transition-colors"
                style={{
                  height: 36,
                  borderRadius: "var(--r-tag)",
                  background: active ? "var(--accent-soft)" : "var(--background-elevated)",
                  color: active ? "var(--accent)" : "var(--foreground-70)",
                  border: `1px solid ${active ? "var(--border-accent)" : "var(--border)"}`,
                }}
              >
                {c.name}
              </button>
            );
          })}
        </div>

        {activeCat === ALL && !query && featured.length > 0 && <ReviewsHero videos={featured} />}

        {activeCat === ALL && !query && newest.length > 0 && (
          <section className="space-y-[12px]">
            <h2 className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              {t("pages.reviews.newReleases")}
            </h2>
            <div className="-mx-[16px] flex snap-x snap-mandatory gap-[12px] overflow-x-auto px-[16px] pb-[8px] sm:mx-0 sm:px-0" style={{ scrollbarWidth: "thin" }}>
              {newest.map((v) => (
                <div key={v.id} className="snap-start" style={{ flex: "0 0 240px" }}>
                  <VideoCard video={v} />
                </div>
              ))}
            </div>
          </section>
        )}

        <section className="relative space-y-[12px]">
          <h2 className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            {sectionTitle}
          </h2>
          {((initialLoading || refreshing) && videos.length === 0) ? (
            <VideoGridSkeleton />
          ) : videos.length === 0 ? (
            <EmptyState icon={SearchX} title={t("pages.reviews.nothingFound")} description={t("pages.reviews.nothingFoundDesc")} />
          ) : (
            <div
              className={cn(
                "grid grid-cols-2 gap-[16px] transition-opacity duration-200 sm:grid-cols-3 lg:grid-cols-4",
                refreshing && "pointer-events-none opacity-55",
              )}
            >
              {videos.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          )}
          {refreshing && videos.length > 0 && (
            <div className="pointer-events-none absolute inset-x-0 top-[44px] flex justify-center pt-[48px]">
              <span
                className="inline-flex items-center gap-[8px] rounded-full px-[12px] py-[6px] text-[12px] font-medium"
                style={{ background: "var(--background-elevated)", color: "var(--foreground-70)", boxShadow: "var(--shadow-card)" }}
              >
                <Loader2 size={14} className="animate-spin" style={{ color: "var(--accent)" }} />
                {t("pages.reviews.loading")}
              </span>
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
