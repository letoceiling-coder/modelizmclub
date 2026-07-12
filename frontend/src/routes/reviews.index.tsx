import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Video, VideoCategory } from "@/lib/mock";
import { fetchVideos, fetchVideoCategories } from "@/lib/api/reviews";
import { VideoCard } from "@/components/reviews/VideoCard";
import { ReviewsHero } from "@/components/reviews/ReviewsHero";
import { SearchInput } from "@/components/ui/search-input";
import { EmptyState } from "@/components/ui/empty-state";
import { SearchX } from "lucide-react";

export const Route = createFileRoute("/reviews/")({
  head: () => ({ meta: [{ title: "Обзоры — МоДелизМ" }] }),
  component: ReviewsPage,
});

const ALL = "all";

function ReviewsPage() {
  const [videos, setVideos] = useState<Video[]>([]);
  const [featured, setFeatured] = useState<Video[]>([]);
  const [categories, setCategories] = useState<VideoCategory[]>([]);
  const [activeCat, setActiveCat] = useState<string>(ALL); // slug or "all"
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  // categories: "Все" first, then alphabetical
  const tabs = useMemo(() => {
    const sorted = [...categories].sort((a, b) =>
      (a.name ?? "").localeCompare(b.name ?? "", "ru"),
    );
    return [{ id: ALL, name: "Все", slug: ALL }, ...sorted];
  }, [categories]);

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
    setLoading(true);
    fetchVideos({ q: query || undefined, categorySlug: activeCat })
      .then((list) => { if (alive) setVideos(list); })
      .catch(() => {})
      .finally(() => { if (alive) setLoading(false); });
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
          placeholder="Поиск обзоров"
          aria-label="Поиск обзоров"
        />

        {/* category tabs — Все first, then alphabetical */}
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

        {/* hero — only in the "Все" tab with no active search */}
        {activeCat === ALL && !query && featured.length > 0 && <ReviewsHero videos={featured} />}

        {/* "Новинки" horizontal row — only in "Все" with no search */}
        {activeCat === ALL && !query && newest.length > 0 && (
          <section className="space-y-[12px]">
            <h2 className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Новинки
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

        {/* main grid — filtered + sorted newest-first */}
        <section className="space-y-[12px]">
          <h2 className="font-display text-[20px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            {query ? "Результаты поиска" : "Все обзоры"}
          </h2>
          {loading ? (
            <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>Загрузка…</p>
          ) : videos.length === 0 ? (
            <EmptyState icon={SearchX} title="Ничего не найдено" description="Попробуйте изменить запрос или категорию." />
          ) : (
            <div className="grid grid-cols-2 gap-[16px] sm:grid-cols-3 lg:grid-cols-4">
              {videos.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          )}
        </section>
      </div>
    </AppLayout>
  );
}
