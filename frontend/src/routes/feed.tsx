import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Loader2, Newspaper, UserPlus, Compass, Bookmark, Clock } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CreatePostMenu, type ComposerDraft, type ComposerSelection } from "@/components/feed/CreatePostMenu";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
import { EventsHero } from "@/components/feed/EventsHero";
import { FindYourPeopleSheet } from "@/components/feed/FindYourPeopleSheet";
import { PostCard } from "@/components/PostCard";
import { PostCardSkeleton } from "@/components/feed/Skeleton";
import { FeedFilterTabs, type FeedFilter } from "@/components/feed/FeedFilterTabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useStore, selectors } from "@/lib/store";
import type { Post, Category, Banner } from "@/lib/mock";
import { fetchFeed, fetchPost } from "@/lib/api/feed";
import { fetchPostCategories, categoryIdByName, getCachedPostCategories } from "@/lib/api/categories";
import { parseTaxonomyId } from "@/lib/taxonomy";
import { fetchBanners } from "@/lib/api/banners";
import { prefetchCategoryRoomStats } from "@/lib/hooks/useCategoryRoomStats";
import { getHiddenPostIds, hidePostId } from "@/lib/hidden-posts";
import { SponsoredPostCard } from "@/components/feed/SponsoredPostCard";
import { FeedRightRail } from "@/components/feed/FeedRightRail";
import { VerificationBanner } from "@/components/auth/VerificationBanner";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { FEED_FILTER_ACTIONS, firstAllowedFeedFilter } from "@/lib/feed-guest-access/registry";
import { ensurePublicBootstrap } from "@/lib/boot/applyPublicBootstrap";
import { FeedPageSkeleton } from "@/components/boot/PageSkeletons";

import i18n from "@/lib/i18n";

function findCategoryName(categories: Category[], id: string): string | null {
  for (const c of categories) {
    if (c.id === id) return c.name;
    for (const s of c.subcategories) {
      if (s.id === id) return s.name;
      for (const t of s.children ?? []) {
        if (t.id === id) return t.name;
      }
    }
  }
  return null;
}

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: i18n.t("pages.feed.metaTitle") }, { name: "description", content: i18n.t("pages.feed.metaDescription") }] }),
  // `category` — set by landing's "Направления" cards (routes/index.tsx
  // CategoriesSection) so a direction click opens /feed pre-filtered to
  // that direction instead of the unfiltered feed. Value is a category
  // *name*, matching the existing chip-filter convention below
  // (activeCategory / categoryIdByName both key by name, not id) — both
  // the landing and this page read categories from the same
  // fetchPostCategories() source, so the names are guaranteed to match.
  validateSearch: (search: Record<string, unknown>): { composer?: string; category?: string; taxonomy_id?: number; post?: string } => ({
    composer: (search.composer as string) || undefined,
    category: (search.category as string) || undefined,
    taxonomy_id: parseTaxonomyId(search.taxonomy_id),
    post: typeof search.post === "string" && search.post ? search.post : undefined,
  }),
  loader: async () => {
    await ensurePublicBootstrap();
    const [feed, banners, categories] = await Promise.all([
      fetchFeed({ filter: "all", perPage: 20 }).catch(() => ({ posts: [] as Post[] })),
      fetchBanners("feed").catch(() => [] as Banner[]),
      fetchPostCategories().catch(() => getCachedPostCategories() ?? []),
    ]);
    void prefetchCategoryRoomStats();
    return { posts: feed.posts, banners, categories };
  },
  staleTime: 30_000,
  pendingComponent: FeedPageSkeleton,
  component: FeedPage,
});

const PAGE_SIZE = 6;

function FeedPage() {
  const { t } = useTranslation();
  const { composer, category: categoryFromUrl, taxonomy_id: taxonomyFromUrl, post: focusPostId } = Route.useSearch();
  const navigate = useNavigate();
  const me = useStore(selectors.currentUser);
  const loaded = Route.useLoaderData();
  const [posts, setPosts] = useState<Post[]>(() => loaded.posts);
  const [categories, setCategories] = useState<Category[]>(() => loaded.categories);
  const [banners, setBanners] = useState<Banner[]>(() => loaded.banners);
  const [filter, setFilter] = useState<FeedFilter>(categoryFromUrl || taxonomyFromUrl ? "categories" : "all");
  const [activeCategory, setActiveCategory] = useState<string | null>(categoryFromUrl ?? null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSelection, setComposerSelection] = useState<ComposerSelection | undefined>(undefined);
  const [composerDraft, setComposerDraft] = useState<ComposerDraft>({ text: "", files: [] });
  const [composerSession, setComposerSession] = useState(0);
  const [draftClearToken, setDraftClearToken] = useState(0);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => getHiddenPostIds());
  const { guardAction, isAllowed, ready: guestAccessReady } = useGuestAccess();

  useEffect(() => {
    if (!focusPostId) return;
    let cancelled = false;
    const node = document.getElementById(`feed-post-${focusPostId}`);
    if (node) {
      node.scrollIntoView({ block: "start", behavior: "smooth" });
      return;
    }
    void fetchPost(focusPostId)
      .then((post) => {
        if (cancelled) return;
        setPosts((cur) => (cur.some((p) => p.id === post.id) ? cur : [post, ...cur]));
        window.setTimeout(() => {
          document.getElementById(`feed-post-${post.id}`)?.scrollIntoView({ block: "start", behavior: "smooth" });
        }, 50);
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [focusPostId]);

  // Direct URL /feed?category=… must not bypass admin filter settings.
  useEffect(() => {
    if (!guestAccessReady) return;
    if ((categoryFromUrl || taxonomyFromUrl) && !isAllowed("feed.category.select")) {
      setFilter("all");
      setActiveCategory(null);
      navigate({ to: "/feed", search: {}, replace: true });
    }
  }, [guestAccessReady, categoryFromUrl, taxonomyFromUrl, isAllowed, navigate]);

  useEffect(() => {
    if (!guestAccessReady) return;
    if (!isAllowed(FEED_FILTER_ACTIONS[filter])) {
      const next = firstAllowedFeedFilter(isAllowed);
      setFilter(next);
      if (next !== "categories") setActiveCategory(null);
    }
  }, [guestAccessReady, isAllowed, filter]);

  useEffect(() => {
    if (composer === "open") {
      setComposerOpen(true);
      navigate({ to: "/feed", search: {}, replace: true });
    }
  }, [composer, navigate]);

  const toggleSave = (id: string) =>
    setSavedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const hideFeedPost = (id: string) => {
    hidePostId(id);
    setHiddenIds((prev) => new Set(prev).add(id));
    setPosts((cur) => cur.filter((p) => p.id !== id));
  };

  const [initialLoading, setInitialLoading] = useState(() => loaded.posts.length === 0);
  const usedLoaderFeed = useRef(loaded.posts.length > 0);
  const hasPostsRef = useRef(loaded.posts.length > 0);
  const filterAllowed = guestAccessReady
    ? isAllowed(FEED_FILTER_ACTIONS[filter])
    : filter === "all";

  useEffect(() => {
    if (loaded.categories.length) setCategories(loaded.categories);
    else fetchPostCategories().then(setCategories).catch(() => {});
    if (loaded.banners.length) setBanners(loaded.banners);
    else fetchBanners("feed").then(setBanners).catch(() => {});
  }, [loaded.banners, loaded.categories]);

  useEffect(() => {
    if (!taxonomyFromUrl || categories.length === 0) return;
    const found = findCategoryName(categories, String(taxonomyFromUrl));
    if (found) {
      setFilter("categories");
      setActiveCategory(found);
    }
  }, [taxonomyFromUrl, categories]);

  useEffect(() => {
    hasPostsRef.current = posts.length > 0;
  }, [posts.length]);

  useEffect(() => {
    let alive = true;
    // Public "all" feed must not wait for session/subscription: otherwise a
    // full page load keeps PostCardSkeleton forever while /ads already shows photos.
    if (!filterAllowed) {
      if (!guestAccessReady) return;
      setPosts([]);
      setInitialLoading(false);
      return;
    }
    if (filter === "categories" && !activeCategory && !taxonomyFromUrl) {
      setPosts([]);
      setInitialLoading(false);
      return;
    }
    if (
      usedLoaderFeed.current &&
      filter === "all" &&
      !activeCategory &&
      !taxonomyFromUrl
    ) {
      usedLoaderFeed.current = false;
      setInitialLoading(false);
      return;
    }
    usedLoaderFeed.current = false;
    if (!hasPostsRef.current) setInitialLoading(true);
    const categoryId = taxonomyFromUrl ?? (activeCategory ? categoryIdByName(activeCategory) : undefined);
    const query =
      filter === "following"
        ? { filter: "following" as const }
        : filter === "scheduled"
          ? { filter: "scheduled" as const }
          : filter === "categories" && (activeCategory || taxonomyFromUrl)
            ? { filter: "category" as const, categoryId, categoryName: activeCategory ?? undefined }
            : { filter: "all" as const };
    fetchFeed({ ...query, perPage: 50 })
      .then((r) => {
        if (!alive) return;
        setPosts(r.posts);
        hasPostsRef.current = r.posts.length > 0;
        setSavedIds((prev) => {
          const next = new Set(prev);
          for (const p of r.posts) if (p.isSaved) next.add(p.id);
          return next;
        });
      })
      .catch(() => {
        if (alive) setPosts([]);
      })
      .finally(() => {
        if (alive) setInitialLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [filter, activeCategory, taxonomyFromUrl, guestAccessReady, filterAllowed]);

  const filtered = useMemo(() => {
    const visiblePosts = posts.filter((p) => !hiddenIds.has(p.id));
    if (filter === "saved") return visiblePosts.filter((p) => savedIds.has(p.id) || p.isSaved);
    return visiblePosts;
  }, [posts, filter, savedIds, hiddenIds]);

  const [visible, setVisible] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setVisible(PAGE_SIZE);
  }, [filter, activeCategory]);

  useEffect(() => {
    if (initialLoading) return;
    const node = sentinelRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        const e = entries[0];
        if (e.isIntersecting && visible < filtered.length && !loadingMore) {
          setLoadingMore(true);
          setVisible((v) => Math.min(v + PAGE_SIZE, filtered.length));
          setLoadingMore(false);
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [filtered.length, visible, loadingMore, initialLoading]);

  // Post creation itself (upload + createPost + publish) happens inside
  // CreatePostForm against the real API — this just closes the composer
  // and prepends whatever real Post the backend returned, instead of the
  // fully client-fabricated placeholder this used to construct (which
  // never touched the network at all, so nothing was ever actually saved).
  const addPost = (post: Post) => {
    setComposerOpen(false);
    setComposerDraft({ text: "", files: [] });
    setDraftClearToken((t) => t + 1);
    if (post.status === "scheduled") {
      if (filter === "scheduled") {
        setPosts((cur) => [post, ...cur]);
      }
      return;
    }
    setPosts((cur) => [{ ...post, isFollowing: true }, ...cur]);
  };

  const removePost = (id: string) => {
    setPosts((cur) => cur.filter((p) => p.id !== id));
  };

  const patchPost = (id: string, patch: Partial<Post>) => {
    setPosts((cur) => cur.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };

  const slice = filtered.slice(0, visible);

  return (
    <AppLayout footer rightColumn={<FeedRightRail />}>
      <div className="space-y-[16px]">
        <VerificationBanner />
        <EventsHero />

        <CreatePostMenu
          me={me}
          draftClearToken={draftClearToken}
          onCompose={(sel, draft) => {
            guardAction("feed.compose.open", () => {
              setComposerSelection(sel);
              setComposerDraft(draft);
              setComposerSession((s) => s + 1);
              setComposerOpen(true);
            });
          }}
        />

        <FindYourPeopleSheet />

        <FeedFilterTabs value={filter} onChange={setFilter} />

        {filter === "categories" && (
          <div className="-mx-3 flex gap-[6px] overflow-x-auto px-[12px] pb-[4px] no-scrollbar lg:mx-0 lg:px-0">
            {categories.map((c) => {
              const active = activeCategory === c.name;
              return (
                <button
                  key={c.id}
                  onClick={() => guardAction("feed.category.select", () => setActiveCategory(active ? null : c.name))}
                  className="shrink-0 rounded-[var(--r-pill)] border px-[14px] py-[6px] text-[13px] transition-colors"
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
          {initialLoading && slice.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => <PostCardSkeleton key={i} />)
          ) : slice.length === 0 ? (
            filter === "following" ? (
              <EmptyState
                icon={UserPlus}
                title={t("pages.feed.emptyFollowingTitle")}
                description={t("pages.feed.emptyFollowingDesc")}
                action={{ label: t("pages.feed.findAuthors"), onClick: () => guardAction("feed.empty.action", () => setFilter("all")) }}
              />
            ) : filter === "categories" && !activeCategory ? (
              <EmptyState
                icon={Compass}
                title={t("pages.feed.selectCategoryTitle")}
                description={t("pages.feed.selectCategoryDesc")}
              />
            ) : filter === "saved" ? (
              <EmptyState
                icon={Bookmark}
                title={t("pages.feed.emptySavedTitle")}
                description={t("pages.feed.emptySavedDesc")}
                action={{ label: t("pages.feed.backToFeed"), onClick: () => guardAction("feed.empty.action", () => setFilter("all")) }}
              />
            ) : filter === "scheduled" ? (
              <EmptyState
                icon={Clock}
                title={t("pages.feed.emptyScheduledTitle")}
                description={t("pages.feed.emptyScheduledDesc")}
                action={{ label: t("pages.feed.createPost"), onClick: () => guardAction("feed.compose.open", () => setComposerOpen(true)) }}
              />
            ) : (
              <EmptyState
                icon={Newspaper}
                title={t("pages.feed.emptyPostsTitle")}
                description={t("pages.feed.emptyPostsDesc")}
                action={{ label: t("pages.feed.showAll"), onClick: () => guardAction("feed.empty.action", () => { setFilter("all"); setActiveCategory(null); }) }}
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
                  onDelete={removePost}
                  onHide={hideFeedPost}
                  onTogglePost={patchPost}
                />,
              ];
              // Каждые 4 поста — нативный рекламный пост (не в «Запланированные»)
              if (filter !== "scheduled" && (idx + 1) % 4 === 0 && banners.length > 0) {
                const banner = banners[Math.floor(idx / 4) % banners.length];
                nodes.push(<SponsoredPostCard key={`ad-${idx}-${banner.id}`} banner={banner} />);
              }
              return nodes;
            })
          )}

          {!initialLoading && visible < filtered.length && (
            <div ref={sentinelRef} className="flex items-center justify-center py-[24px]">
              <motion.div
                animate={{ rotate: 360 }}
                transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
              >
                <Loader2 className="h-[20px] w-[20px]" style={{ color: "var(--accent)" }} />
              </motion.div>
              <span className="ml-[10px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
                {t("pages.feed.loadingMore")}
              </span>
            </div>
          )}

          {!initialLoading && slice.length > 0 && visible >= filtered.length && (
            <p className="py-[24px] text-center text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.feed.endOfFeed")}
            </p>
          )}
        </div>
      </div>

      <CreatePostModal
        open={composerOpen}
        selection={composerSelection}
        initialDraft={composerDraft}
        formKey={composerSession}
        onClose={() => setComposerOpen(false)}
        onCreate={addPost}
      />
    </AppLayout>
  );
}
