import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import { Loader2, Newspaper, UserPlus, Compass, Bookmark } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CreatePostTrigger } from "@/components/feed/CreatePostTrigger";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
import { EventsHero } from "@/components/feed/EventsHero";
import { FindYourPeopleSheet } from "@/components/feed/FindYourPeopleSheet";
import { PostCard } from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/feed/Skeleton";
import { FeedFilterTabs, type FeedFilter } from "@/components/feed/FeedFilterTabs";
import { EmptyFeedState } from "@/components/feed/EmptyFeedState";
import type { CreatePostPayload } from "@/components/CreatePostForm";
import type { Post, Banner, Category } from "@/lib/types";
import { SponsoredPostCard } from "@/components/feed/SponsoredPostCard";
import { fetchFeed } from "@/lib/api/feed";
import { fetchBanners } from "@/lib/api/public";
import { fetchPostCategories } from "@/lib/api/catalog";
import { useAuth } from "@/components/auth/AuthProvider";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: tStatic("feed.title") },
      { name: "description", content: tStatic("feed.metaDescription") },
    ],
  }),
  validateSearch: (search: Record<string, unknown>) => ({
    composer: (search.composer as string) || undefined,
  }),
  component: FeedPage,
});

const PAGE_SIZE = 6;

function FeedPage() {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const { composer } = Route.useSearch();
  const navigate = useNavigate();
  const [posts, setPosts] = useState<Post[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [feedCategories, setFeedCategories] = useState<Category[]>([]);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [initialLoading, setInitialLoading] = useState(true);
  const [apiPage, setApiPage] = useState(1);
  const [apiHasMore, setApiHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    if (composer === "open") {
      setComposerOpen(true);
      navigate({ to: "/feed", search: { composer: undefined }, replace: true });
    }
  }, [composer, navigate]);

  useEffect(() => {
    let cancelled = false;
    void fetchBanners("feed").then((items) => {
      if (!cancelled) setBanners(items);
    });
    void fetchPostCategories().then((items) => {
      if (!cancelled) setFeedCategories(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const loadFeed = useCallback(
    async (page = 1, append = false) => {
      const apiFilter =
        filter === "following" && isAuthenticated ? ("following" as const) : ("all" as const);
      const { posts: items, hasMore } = await fetchFeed({
        filter: apiFilter,
        page,
        per_page: 20,
      });
      setApiHasMore(hasMore);
      setApiPage(page);
      setPosts((prev) => (append ? [...prev, ...items] : items));
    },
    [filter, isAuthenticated],
  );

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setInitialLoading(true);
      await loadFeed(1, false);
      if (!cancelled) setInitialLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [loadFeed]);

  const toggleSave = (id: string) =>
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const categoryChips = useMemo(() => {
    if (feedCategories.length > 0) return feedCategories;
    const names = [...new Set(posts.map((p) => p.category).filter(Boolean))];
    return names.map((name, i) => ({ id: `api-c${i}`, name, subcategories: [] }));
  }, [feedCategories, posts]);

  const filtered = useMemo(() => {
    if (filter === "following") return posts.filter((p) => p.isFollowing);
    if (filter === "categories" && activeCategory) return posts.filter((p) => p.category === activeCategory);
    if (filter === "saved") {
      return posts.filter((p) => savedIds.has(p.id) || p.isSaved);
    }
    return posts;
  }, [posts, filter, activeCategory, savedIds]);

  const [visible, setVisible] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [filter, activeCategory, posts]);

  useEffect(() => {
    if (initialLoading) return;
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (!e.isIntersecting || loadingMore) return;

        if (visible >= filtered.length && apiHasMore) {
          setLoadingMore(true);
          void loadFeed(apiPage + 1, true).finally(() => setLoadingMore(false));
          return;
        }

        if (visible < filtered.length) {
          setLoadingMore(true);
          setTimeout(() => {
            setVisible((v) => Math.min(v + PAGE_SIZE, filtered.length));
            setLoadingMore(false);
          }, 600);
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [filtered.length, visible, loadingMore, initialLoading, apiHasMore, apiPage, loadFeed]);

  const addPost = (p: CreatePostPayload) => {
    if (p.post.status === "published") {
      setPosts((prev) => [p.post, ...prev]);
    }
  };

  const slice = filtered.slice(0, visible);
  const canLoadMore = visible < filtered.length || apiHasMore;

  return (
    <AppLayout>
      <div className="space-y-[16px]">
        <EventsHero />

        <CreatePostTrigger onOpen={() => setComposerOpen(true)} />

        <FindYourPeopleSheet />

        <FeedFilterTabs value={filter} onChange={setFilter} />

        {filter === "categories" && (
          <div className="-mx-3 flex gap-[6px] overflow-x-auto px-[12px] pb-[4px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0">
            {categoryChips.map((c) => {
              const active = activeCategory === c.name;
              return (
                <button
                  key={c.id}
                  onClick={() => setActiveCategory(active ? null : c.name)}
                  className="shrink-0 rounded-[999px] border px-[14px] py-[6px] text-[13px] transition-colors"
                  style={{
                    background: active ? "var(--accent)" : "var(--background-elevated)",
                    color: active ? "#fff" : "var(--foreground)",
                    borderColor: active ? "var(--accent)" : "var(--border)",
                    fontWeight: active ? 600 : 500,
                  }}
                >
                  {c.name}
                </button>
              );
            })}
          </div>
        )}

        <div className="-mx-3 space-y-[16px] sm:mx-0">
          {initialLoading ? (
            Array.from({ length: 3 }).map((_, i) => <PostCardSkeleton key={i} />)
          ) : slice.length === 0 ? (
            filter === "following" ? (
              <EmptyFeedState
                icon={UserPlus}
                title={t("feed.emptyFollowingTitle")}
                description={t("feed.emptyFollowingDesc")}
                ctaLabel={t("feed.emptyFollowingCta")}
                onCta={() => setFilter("all")}
              />
            ) : filter === "categories" && !activeCategory ? (
              <EmptyFeedState
                icon={Compass}
                title={t("feed.emptyCategoryTitle")}
                description={t("feed.emptyCategoryDesc")}
              />
            ) : filter === "saved" ? (
              <EmptyFeedState
                icon={Bookmark}
                title={t("feed.emptySavedTitle")}
                description={t("feed.emptySavedDesc")}
                ctaLabel={t("feed.emptySavedCta")}
                onCta={() => setFilter("all")}
              />
            ) : (
              <EmptyFeedState
                icon={Newspaper}
                title={t("feed.emptyDefaultTitle")}
                description={t("feed.emptyDefaultDesc")}
                ctaLabel={t("feed.emptyDefaultCta")}
                onCta={() => {
                  setFilter("all");
                  setActiveCategory(null);
                }}
              />
            )
          ) : (
            slice.flatMap((post, idx) => {
              const nodes: React.ReactNode[] = [
                <PostCard
                  key={post.id}
                  post={post}
                  isSavedExternal={savedIds.has(post.id)}
                  onToggleSave={toggleSave}
                />,
              ];
              if ((idx + 1) % 4 === 0 && banners.length > 0) {
                const banner = banners[Math.floor(idx / 4) % banners.length];
                nodes.push(<SponsoredPostCard key={`ad-${idx}-${banner.id}`} banner={banner} />);
              }
              return nodes;
            })
          )}

          {!initialLoading && canLoadMore && (
            <div ref={sentinelRef} className="flex items-center justify-center py-[24px]">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-[20px] w-[20px]" style={{ color: "var(--accent)" }} />
              </motion.div>
              <span className="ml-[10px] text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("feed.loadMore")}</span>
            </div>
          )}

          {!initialLoading && slice.length > 0 && !canLoadMore && (
            <p className="py-[24px] text-center text-[12px]" style={{ color: "var(--foreground-50)" }}>{t("feed.endReached")}</p>
          )}
        </div>
      </div>

      <CreatePostModal open={composerOpen} onClose={() => setComposerOpen(false)} onCreate={addPost} />
    </AppLayout>
  );
}
