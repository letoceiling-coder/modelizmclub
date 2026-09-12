import { createFileRoute, redirect, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { m } from "framer-motion";
import {
  Loader2,
  Newspaper,
  UserPlus,
  Compass,
  Bookmark,
  Clock,
  Hash,
  X,
  RefreshCw,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import {
  CreatePostMenu,
  type ComposerDraft,
  type ComposerSelection,
} from "@/components/feed/CreatePostMenu";
import { CreatePostModal } from "@/components/feed/CreatePostModal";
import { EventsHero, sortBanners } from "@/components/feed/EventsHero";
import { variantUrl } from "@/lib/media/variants";
import { FindYourPeopleSheet } from "@/components/feed/FindYourPeopleSheet";
import { PostCard } from "@/components/post/PostCard";
import { PostCardSkeleton } from "@/components/feed/Skeleton";
import { FeedFilterTabs, type FeedFilter } from "@/components/feed/FeedFilterTabs";
import { EmptyState } from "@/components/ui/empty-state";
import { useCurrentUser } from "@/lib/session";
import type { Post, Category, Banner } from "@/lib/mock";
import { fetchFeed, type FeedQuery, type FeedResult } from "@/lib/api/feed";
import {
  fetchPostCategories,
  categoryIdByName,
  getCachedPostCategories,
} from "@/lib/api/categories";
import { parseTaxonomyId } from "@/lib/taxonomy";
import { fetchBannersWithSettings, type BannerPack } from "@/lib/api/banners";
import { prefetchCategoryRoomStats } from "@/lib/hooks/useCategoryRoomStats";
import { getHiddenPostIds, hidePostId } from "@/lib/hidden-posts";
import { SponsoredPostCard } from "@/components/feed/SponsoredPostCard";
import { FeedRightRail } from "@/components/feed/FeedRightRail";
import { VerificationBanner } from "@/components/auth/VerificationBanner";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { FEED_FILTER_ACTIONS, firstAllowedFeedFilter } from "@/lib/feed-guest-access/registry";
import { ensurePublicBootstrap } from "@/lib/boot/applyPublicBootstrap";
import { FeedPageSkeleton } from "@/components/boot/PageSkeletons";
import { GC, STALE, qk } from "@/lib/queries/keys";
import {
  feedPostsOf,
  patchFeedPost,
  prependFeedPost,
  removeFeedPost,
  toggleFeedLike,
  toggleFeedRepost,
  toggleFeedSave,
  type FeedPages,
} from "@/lib/queries/feed";

import i18n from "@/lib/i18n";
import { getToken } from "@/lib/api/client";
import { reportReadFailure } from "@/lib/errors/handle";
import { RouteErrorState } from "@/components/layout/RouteErrorState";

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

const EMPTY_FEED: FeedResult = { posts: [], page: 1, lastPage: 1, total: 0 };

/** One network page of the feed. The list grows by fetching the next page —
 *  there is no client-side ceiling on how many posts can be shown. */
/** Чип направления: та же высота 32, что и у фильтров ленты, и та же
 *  невидимая ::after-коробка, поднимающая зону нажатия до 44. */
const CATEGORY_CHIP_CLASS =
  'relative h-[32px] shrink-0 rounded-[var(--r-pill)] border px-[14px] text-[13px] leading-none transition-colors after:absolute after:inset-x-0 after:-inset-y-[6px] after:content-[""]';

const PAGE_SIZE = 20;
/*
 * Первая страница меньше остальных — она едет в серверной разметке.
 *
 * При двадцати записях документ весил 190 КБ, а браузер находил в нём 15
 * картинок на 238 КБ и начинал качать их все сразу. На канале 1,6 Мбит/с
 * LCP-картинка весом 30 КБ ждала своей очереди 2258 мс (замер 12.09): до её
 * завершения стартовало 42 запроса на 743 КБ. Шесть записей закрывают первый
 * экран с запасом, остальные догружает та же бесконечная прокрутка, что и
 * раньше, — страницей в PAGE_SIZE.
 */
const FIRST_PAGE_SIZE = 6;

export const Route = createFileRoute("/feed")({
  errorComponent: RouteErrorState,
  head: ({ loaderData }) => {
    // Первый баннер — LCP-элемент страницы. Preload в head поднимает его
    // загрузку к самому началу документа: браузер начинает тянуть картинку
    // одновременно с HTML, не дожидаясь разбора и выполнения бандла.
    const first = loaderData?.hero
      ? sortBanners(loaderData.hero.banners.filter((b) => b.active !== false))[0]
      : undefined;
    const preloadHref = first?.image ? variantUrl(first.image, "medium") : undefined;
    return {
      meta: [
        { title: i18n.t("pages.feed.metaTitle") },
        { name: "description", content: i18n.t("pages.feed.metaDescription") },
      ],
      links: preloadHref
        ? [{ rel: "preload", as: "image", href: preloadHref, fetchPriority: "high" }]
        : [],
    };
  },
  // `category` — set by landing's "Направления" cards (routes/index.tsx
  // CategoriesSection) so a direction click opens /feed pre-filtered to
  // that direction instead of the unfiltered feed. Value is a category
  // *name*, matching the existing chip-filter convention below
  // (activeCategory / categoryIdByName both key by name, not id) — both
  // the landing and this page read categories from the same
  // fetchPostCategories() source, so the names are guaranteed to match.
  // `tag` — a hashtag chip from a post card; the backend's feed filter
  // takes the bare name, so it is stored without the leading "#".
  // `post` — только для переадресации старых ссылок «Поделиться» (см.
  // beforeLoad выше). Лента его больше не отрисовывает: у записи есть
  // собственный адрес /post/{uuid}.
  validateSearch: (
    search: Record<string, unknown>,
  ): {
    composer?: string;
    category?: string;
    taxonomy_id?: number;
    post?: string;
    tag?: string;
  } => ({
    composer: (search.composer as string) || undefined,
    category: (search.category as string) || undefined,
    taxonomy_id: parseTaxonomyId(search.taxonomy_id),
    post: typeof search.post === "string" && search.post ? search.post : undefined,
    tag:
      typeof search.tag === "string" && search.tag
        ? search.tag.replace(/^#/, "").slice(0, 64)
        : undefined,
  }),
  /*
   * До появления /post/{uuid} записью делились ссылкой /feed?post={id}: лента
   * подтягивала запись и подводила к ней скроллом. Такие ссылки уже разосланы
   * и должны открываться — поэтому параметр не удалён, а переадресован на
   * собственный адрес записи. Замена постоянная (replace), чтобы «назад» не
   * возвращало на редирект.
   *
   * Тип аргумента выписан руками намеренно. Стоит положиться на вывод
   * (`({ search })` без аннотации) — и разрешение типа контекста у маршрута с
   * validateSearch зацикливается: TypeScript схлопывает ожидаемый возврат
   * beforeLoad до never, и ветка «параметра нет, ничего не делаем» перестаёт
   * проходить проверку. Форма search здесь та же, что отдаёт validateSearch.
   */
  beforeLoad: async ({ search }: { search: { post?: string } }) => {
    if (search.post) {
      throw redirect({
        to: "/post/$uuid",
        params: { uuid: search.post },
        replace: true,
        // 301, а не умолчательный 307: адрес записи сменился насовсем, и
        // поисковику надо перенести на него вес старых ссылок. Кешируется
        // только пара «/feed?post=<uuid> → /post/<uuid>»; сама /feed без
        // параметра — другой адрес и не затрагивается.
        statusCode: 301,
      });
    }
  },
  loader: async () => {
    await ensurePublicBootstrap();
    const [feed, inline, categories, hero] = await Promise.all([
      fetchFeed({ filter: "all", perPage: FIRST_PAGE_SIZE }).catch(() => EMPTY_FEED),
      fetchBannersWithSettings("feed").catch(() => null),
      fetchPostCategories().catch(() => getCachedPostCategories() ?? []),
      // Пак героя — отдельное размещение («events»), и до 04.09 его тянул сам
      // компонент из useEffect. Из-за этого <img> героя не попадал в исходный
      // HTML, и браузер узнавал о LCP-картинке только после гидрации.
      fetchBannersWithSettings("events").catch(() => null),
    ]);
    void prefetchCategoryRoomStats();
    return {
      feed,
      banners: (inline?.banners ?? []) as Banner[],
      categories,
      hero: hero as BannerPack | null,
    };
  },
  staleTime: 30_000,
  pendingComponent: FeedPageSkeleton,
  component: FeedPage,
});

function FeedPage() {
  const { t } = useTranslation();
  const {
    composer,
    category: categoryFromUrl,
    taxonomy_id: taxonomyFromUrl,
    tag,
  } = Route.useSearch();
  const navigate = useNavigate();
  const me = useCurrentUser();
  const loaded = Route.useLoaderData();
  const queryClient = useQueryClient();
  const [categories, setCategories] = useState<Category[]>(() => loaded.categories);
  const [banners, setBanners] = useState<Banner[]>(() => loaded.banners);
  const [filter, setFilter] = useState<FeedFilter>(
    categoryFromUrl || taxonomyFromUrl ? "categories" : "all",
  );
  const [activeCategory, setActiveCategory] = useState<string | null>(categoryFromUrl ?? null);
  const [composerOpen, setComposerOpen] = useState(false);
  const [composerSelection, setComposerSelection] = useState<ComposerSelection | undefined>(
    undefined,
  );
  const [composerDraft, setComposerDraft] = useState<ComposerDraft>({ text: "", files: [] });
  const [composerSession, setComposerSession] = useState(0);
  const [hiddenIds, setHiddenIds] = useState<Set<string>>(() => getHiddenPostIds());
  const { guardAction, isAllowed, ready: guestAccessReady } = useGuestAccess();

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
      navigate({
        to: "/feed",
        search: (prev) => ({ ...prev, composer: undefined }),
        replace: true,
      });
    }
  }, [composer, navigate]);

  useEffect(() => {
    if (loaded.categories.length) setCategories(loaded.categories);
    else
      fetchPostCategories()
        .then(setCategories)
        .catch((e) => reportReadFailure(e, "направления ленты"));
    if (loaded.banners.length) setBanners(loaded.banners);
    else
      fetchBannersWithSettings("feed")
        .then((pack) => setBanners(pack.banners))
        .catch((e) => reportReadFailure(e, "баннеры ленты"));
  }, [loaded.banners, loaded.categories]);

  useEffect(() => {
    if (!taxonomyFromUrl || categories.length === 0) return;
    const found = findCategoryName(categories, String(taxonomyFromUrl));
    if (found) {
      setFilter("categories");
      setActiveCategory(found);
    }
  }, [taxonomyFromUrl, categories]);

  const filterAllowed = guestAccessReady
    ? isAllowed(FEED_FILTER_ACTIONS[filter])
    : filter === "all";
  const needsCategoryPick = filter === "categories" && !activeCategory && !taxonomyFromUrl;

  // "saved" and "categories" both read the "all" endpoint (saved is a viewer
  // flag, not a server filter), so their cache entries are keyed apart by the
  // key below rather than by the request.
  const categoryKey = taxonomyFromUrl ? String(taxonomyFromUrl) : activeCategory;
  // Memoised: the key is a dependency of the cache writer below, and a fresh
  // array every render would re-run every effect that writes to the cache.
  const feedKey = useMemo(
    () => qk.feed(filter, filter === "categories" ? categoryKey : null, tag ?? null),
    [filter, categoryKey, tag],
  );

  const requestFor = useCallback(
    (page: number): FeedQuery => {
      const base: FeedQuery =
        filter === "following"
          ? { filter: "following" }
          : filter === "scheduled"
            ? { filter: "scheduled" }
            : filter === "categories" && (activeCategory || taxonomyFromUrl)
              ? {
                  filter: "category",
                  categoryId:
                    taxonomyFromUrl ??
                    (activeCategory ? categoryIdByName(activeCategory) : undefined),
                  categoryName: activeCategory ?? undefined,
                }
              : { filter: "all" };
      // Первая страница — короткая, дальше обычными порциями.
      return { ...base, hashtag: tag, page, perPage: page <= 1 ? FIRST_PAGE_SIZE : PAGE_SIZE };
    },
    [filter, activeCategory, taxonomyFromUrl, tag],
  );

  // The route loader already fetched page 1 of the default feed — hand it to
  // the query as initial data instead of firing the same request twice. Any
  // other key (a filter, a category, a hashtag) fetches on its own.
  const initialData: FeedPages | undefined =
    filter === "all" && !tag && loaded.feed.posts.length > 0
      ? { pages: [loaded.feed], pageParams: [1] }
      : undefined;

  /*
   * Серверная выдача анонимна, и для вошедшего она врёт про права.
   *
   * Загрузчик маршрута работает на сервере, а токен лежит в localStorage —
   * дотянуться до него оттуда нельзя. Поэтому у постов, отрисованных на
   * сервере, `can` всегда гостевой: `react: false` даже там, где тот же API с
   * токеном отвечает `true`. Дальше <Gated> видит не-гостя с запретом и
   * убирает кнопку лайка совсем — вошедший пользователь оставался без неё,
   * пока гость её видел (Gated гостя из этого правила исключает).
   *
   * Помечаем серверные данные как уже устаревшие, когда токен есть: разметка
   * с сервера показывается сразу — LCP не страдает, — но запрос уходит и
   * возвращает права настоящего зрителя. Без токена данные и правда свежие,
   * перезапрашивать нечего.
   */
  const initialDataUpdatedAt = initialData && getToken() ? 0 : undefined;

  // Explicit type arguments: with an `initialData` that may be undefined the
  // overload resolution otherwise widens the page param to `unknown`.
  const feedQuery = useInfiniteQuery<FeedResult, Error, FeedPages, typeof feedKey, number>({
    queryKey: feedKey,
    enabled: filterAllowed && !needsCategoryPick,
    initialPageParam: 1,
    queryFn: ({ pageParam }) => fetchFeed(requestFor(pageParam)),
    getNextPageParam: (last) => (last.page < last.lastPage ? last.page + 1 : undefined),
    staleTime: STALE.feed,
    gcTime: GC.feed,
    initialData,
    initialDataUpdatedAt,
  });

  const posts = useMemo(() => feedPostsOf(feedQuery.data), [feedQuery.data]);

  const updateFeed = useCallback(
    (fn: (data: FeedPages | undefined) => FeedPages | undefined) => {
      queryClient.setQueryData<FeedPages>(feedKey, (data) => fn(data as FeedPages | undefined));
    },
    [queryClient, feedKey],
  );

  const hideFeedPost = (id: string) => {
    hidePostId(id);
    setHiddenIds((prev) => new Set(prev).add(id));
    updateFeed((data) => removeFeedPost(data, id));
  };

  const filtered = useMemo(() => {
    const visiblePosts = posts.filter((p) => !hiddenIds.has(p.id));
    if (filter === "saved") return visiblePosts.filter((p) => p.isSaved);
    return visiblePosts;
  }, [posts, filter, hiddenIds]);

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = feedQuery;
  const sentinelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const node = sentinelRef.current;
    if (!node || !hasNextPage) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting && !isFetchingNextPage) void fetchNextPage();
      },
      { rootMargin: "600px" },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage, filtered.length]);

  // Post creation itself (upload + createPost + publish) happens inside
  // CreatePostForm against the real API — this just closes the composer
  // and prepends whatever real Post the backend returned.
  const addPost = (post: Post) => {
    setComposerOpen(false);
    setComposerDraft({ text: "", files: [] });
    if (post.status === "scheduled") {
      if (filter === "scheduled") updateFeed((data) => prependFeedPost(data, post));
      return;
    }
    updateFeed((data) => prependFeedPost(data, { ...post, isFollowing: true }));
  };

  const removePost = (id: string) => updateFeed((data) => removeFeedPost(data, id));
  const patchPost = (id: string, patch: Partial<Post>) =>
    updateFeed((data) => patchFeedPost(data, id, patch));

  /** Optimistic like/save/repost straight into the cache; the card calls this
   *  again with the previous value when the request fails, and because every
   *  updater is idempotent that restores the exact counter it started from. */
  const applyOptimistic = (id: string, kind: "like" | "save" | "repost", next: boolean) => {
    updateFeed((data) =>
      kind === "like"
        ? toggleFeedLike(data, id, next)
        : kind === "save"
          ? toggleFeedSave(data, id, next)
          : toggleFeedRepost(data, id, next),
    );
  };

  const initialLoading = feedQuery.isPending && filterAllowed && !needsCategoryPick;
  const loadFailed = feedQuery.isError && filtered.length === 0;
  const activeTag = tag ?? null;
  const clearTag = () => navigate({ to: "/feed", search: (prev) => ({ ...prev, tag: undefined }) });

  return (
    <AppLayout footer rightColumn={<FeedRightRail />}>
      <div className="space-y-[16px]">
        <VerificationBanner />
        <EventsHero initial={loaded.hero} />

        <CreatePostMenu
          me={me}
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

        {activeTag && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.feed.tagFilter")}
            </span>
            <button
              type="button"
              onClick={clearTag}
              className="inline-flex min-h-[44px] items-center gap-1.5 rounded-[var(--r-pill)] border px-3 py-1.5 text-[13px] font-semibold transition-colors"
              style={{
                background: "var(--accent-soft)",
                borderColor: "var(--accent)",
                color: "var(--accent)",
              }}
              aria-label={t("pages.feed.tagClear", { tag: activeTag })}
            >
              <Hash className="h-[14px] w-[14px]" />
              <span className="font-mono">{activeTag}</span>
              <X className="h-[14px] w-[14px]" />
            </button>
          </div>
        )}

        {filter === "categories" && (
          <div className="no-scrollbar -mx-3 flex gap-[6px] overflow-x-auto px-[12px] pb-[4px] sm:mx-0 sm:px-0">
            {categories.map((c) => {
              const active = activeCategory === c.name;
              return (
                <button
                  key={c.id}
                  onClick={() =>
                    guardAction("feed.category.select", () =>
                      setActiveCategory(active ? null : c.name),
                    )
                  }
                  className={CATEGORY_CHIP_CLASS}
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

        {/* На телефоне между постами полоса фона 8 px вместо 16: карточки идут
            от края до края, и разделяет их фон, а не воздух внутри колонки. */}
        <div className="-mx-3 space-y-[8px] sm:mx-0 sm:space-y-[16px]">
          {initialLoading && filtered.length === 0 ? (
            Array.from({ length: 3 }).map((_, i) => <PostCardSkeleton key={i} />)
          ) : loadFailed ? (
            <EmptyState
              icon={RefreshCw}
              title={t("pages.feed.loadFailedTitle")}
              description={t("pages.feed.loadFailedDesc")}
              action={{ label: t("pages.feed.retry"), onClick: () => void feedQuery.refetch() }}
            />
          ) : filtered.length === 0 ? (
            activeTag ? (
              <EmptyState
                icon={Hash}
                title={t("pages.feed.emptyTagTitle", { tag: activeTag })}
                description={t("pages.feed.emptyTagDesc")}
                action={{ label: t("pages.feed.tagReset"), onClick: clearTag }}
              />
            ) : filter === "following" ? (
              <EmptyState
                icon={UserPlus}
                title={t("pages.feed.emptyFollowingTitle")}
                description={t("pages.feed.emptyFollowingDesc")}
                action={{
                  label: t("pages.feed.findAuthors"),
                  onClick: () => guardAction("feed.empty.action", () => setFilter("all")),
                }}
              />
            ) : needsCategoryPick ? (
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
                action={{
                  label: t("pages.feed.backToFeed"),
                  onClick: () => guardAction("feed.empty.action", () => setFilter("all")),
                }}
              />
            ) : filter === "scheduled" ? (
              <EmptyState
                icon={Clock}
                title={t("pages.feed.emptyScheduledTitle")}
                description={t("pages.feed.emptyScheduledDesc")}
                action={{
                  label: t("pages.feed.createPost"),
                  onClick: () => guardAction("feed.compose.open", () => setComposerOpen(true)),
                }}
              />
            ) : (
              <EmptyState
                icon={Newspaper}
                title={t("pages.feed.emptyPostsTitle")}
                description={t("pages.feed.emptyPostsDesc")}
                action={{
                  label: t("pages.feed.showAll"),
                  onClick: () =>
                    guardAction("feed.empty.action", () => {
                      setFilter("all");
                      setActiveCategory(null);
                    }),
                }}
              />
            )
          ) : (
            filtered.flatMap((post, idx) => {
              const nodes: React.ReactNode[] = [
                <PostCard
                  key={post.id}
                  post={post}
                  /*
                   * Высший приоритет — одной картинке, и только той, что
                   * действительно становится LCP. Когда баннер событий есть,
                   * LCP — он (замер 12.09: `ef6d4467…`, 54040 px², самый
                   * верх), а первая запись лежит ниже сгиба на 622 px. Две
                   * картинки с `fetchpriority=high` на канале 1,6 Мбит/с
                   * делили полосу, и LCP-картинка весом 30 КБ качалась
                   * 2258 мс. Без баннера первой становится запись — тогда
                   * приоритет её.
                   */
                  priority={idx === 0 && banners.length === 0}
                  isSavedExternal={post.isSaved}
                  onOptimistic={applyOptimistic}
                  onDelete={removePost}
                  onHide={hideFeedPost}
                  onTogglePost={patchPost}
                  onEdited={(next) => patchPost(next.id, next)}
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

          {hasNextPage && (
            <div ref={sentinelRef} className="flex items-center justify-center py-[24px]">
              {isFetchingNextPage && (
                <>
                  <m.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 0.9, repeat: Infinity, ease: "linear" }}
                  >
                    <Loader2 className="h-[20px] w-[20px]" style={{ color: "var(--accent)" }} />
                  </m.div>
                  <span className="ml-[10px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
                    {t("pages.feed.loadingMore")}
                  </span>
                </>
              )}
            </div>
          )}

          {feedQuery.isError && filtered.length > 0 && (
            <div className="flex justify-center py-4">
              <button
                type="button"
                onClick={() => void feedQuery.refetch()}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-[var(--r-button)] border px-4 text-[13px] font-semibold"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              >
                <RefreshCw className="h-[14px] w-[14px]" /> {t("pages.feed.retry")}
              </button>
            </div>
          )}

          {!initialLoading && filtered.length > 0 && !hasNextPage && (
            <p
              className="py-[24px] text-center text-[12px]"
              style={{ color: "var(--foreground-50)" }}
            >
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
