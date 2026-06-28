import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
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
import { useStore, selectors } from "@/lib/store";
import type { Post, Category, Banner } from "@/lib/mock";
import { fetchFeed } from "@/lib/api/feed";
import { fetchPostCategories, categoryIdByName } from "@/lib/api/categories";
import { fetchBanners } from "@/lib/api/banners";
import { SponsoredPostCard } from "@/components/feed/SponsoredPostCard";

export const Route = createFileRoute("/feed")({
  head: () => ({
    meta: [
      { title: "Лента — МоДелизМ Форум" },
      { name: "description", content: "Главная лента сообщества моделистов: новые проекты, фото, обсуждения." },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { composer?: string } => ({
    composer: (search.composer as string) || undefined,
  }),
  component: FeedPage,
});

const PAGE_SIZE = 6;

function FeedPage() {
  const { composer } = Route.useSearch();
  const navigate = useNavigate();
  const me = useStore(selectors.currentUser);
  const [posts, setPosts] = useState<Post[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [banners, setBanners] = useState<Banner[]>([]);
  const [filter, setFilter] = useState<FeedFilter>("all");
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [savedIds, setSavedIds] = useState<Set<string>>(new Set());

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

  const [initialLoading, setInitialLoading] = useState(true);

  useEffect(() => {
    fetchPostCategories().then(setCategories).catch(() => {});
    fetchBanners().then(setBanners).catch(() => {});
  }, []);

  useEffect(() => {
    let alive = true;
    if (filter === "categories" && !activeCategory) {
      setPosts([]);
      setInitialLoading(false);
      return;
    }
    setInitialLoading(true);
    const query =
      filter === "following"
        ? { filter: "following" as const }
        : filter === "categories" && activeCategory
          ? { filter: "category" as const, categoryId: categoryIdByName(activeCategory) }
          : { filter: "all" as const };
    fetchFeed({ ...query, perPage: 50 })
      .then((r) => {
        if (!alive) return;
        setPosts(r.posts);
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
  }, [filter, activeCategory]);

  const filtered = useMemo(() => {
    if (filter === "saved") return posts.filter((p) => savedIds.has(p.id) || p.isSaved);
    return posts;
  }, [posts, filter, savedIds]);

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
  }, [filtered.length, visible, loadingMore, initialLoading]);

  const addPost = (p: CreatePostPayload) => {
    setPosts([
      {
        id: `np${Date.now()}`,
        authorId: me.id,
        date: "только что",
        category: p.category,
        title: p.title,
        text: p.text,
        image: p.photos[0],
        images: p.photos,
        tags: p.subcategory ? [p.subcategory] : [],
        views: 0,
        likes: 0,
        comments: 0,
        saves: 0,
        reposts: 0,
        status: "moderation",
        isFollowing: true,
        commentList: [],
      },
      ...posts,
    ]);
  };

  const slice = filtered.slice(0, visible);

  return (
    <AppLayout>
      <div className="space-y-[16px]">
        <EventsHero />

        <CreatePostTrigger onOpen={() => setComposerOpen(true)} />

        <FindYourPeopleSheet />

        <FeedFilterTabs value={filter} onChange={setFilter} />

        {filter === "categories" && (
          <div className="-mx-3 flex gap-[6px] overflow-x-auto px-[12px] pb-[4px] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:mx-0 lg:px-0">
            {categories.map((c) => {
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
                title="Здесь пока пусто"
                description="Подпишитесь на авторов и сообщества, чтобы видеть их публикации в ленте."
                ctaLabel="Найти авторов"
                onCta={() => setFilter("all")}
              />
            ) : filter === "categories" && !activeCategory ? (
              <EmptyFeedState
                icon={Compass}
                title="Выберите категорию"
                description="Отфильтруйте ленту по интересующему вас направлению моделизма."
              />
            ) : filter === "saved" ? (
              <EmptyFeedState
                icon={Bookmark}
                title="Нет сохранённых публикаций"
                description="Нажмите на иконку закладки у понравившейся публикации."
                ctaLabel="Вернуться в ленту"
                onCta={() => setFilter("all")}
              />
            ) : (
              <EmptyFeedState
                icon={Newspaper}
                title="Публикаций не найдено"
                description="В этой категории пока никто ничего не опубликовал."
                ctaLabel="Показать все"
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
              // Каждые 4 поста — нативный рекламный пост
              if ((idx + 1) % 4 === 0 && banners.length > 0) {
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
                Загружаем ещё…
              </span>
            </div>
          )}

          {!initialLoading && slice.length > 0 && visible >= filtered.length && (
            <p className="py-[24px] text-center text-[12px]" style={{ color: "var(--foreground-50)" }}>
              Вы посмотрели всю ленту
            </p>
          )}
        </div>
      </div>

      <CreatePostModal open={composerOpen} onClose={() => setComposerOpen(false)} onCreate={addPost} />
    </AppLayout>
  );
}
