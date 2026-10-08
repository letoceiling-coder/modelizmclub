import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Plus, X, RotateCcw, AlertCircle, RefreshCw, Megaphone } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { fetchListings, type CatalogParams } from "@/lib/api/listings";
import { ensurePublicBootstrap } from "@/lib/boot/applyPublicBootstrap";
import { prefetchCategoryRoomStats } from "@/lib/hooks/useCategoryRoomStats";
import {
  type FiltersState,
  DEFAULT_FILTERS,
  AdFiltersSheet,
  AdFiltersPanel,
} from "@/components/ads/AdFilters";
import { AdFoundCount, AdSortBar, type SortKey } from "@/components/ads/AdSortBar";
import { CatalogBreadcrumb } from "@/components/ads/CatalogBreadcrumb";
import { CatalogCard } from "@/components/ads/CatalogCard";
import { CatalogCardSkeleton } from "@/components/ads/CatalogCardSkeleton";
import { CATALOG_GRID } from "@/components/ads/catalogGrid";
import { AutoLoadMore } from "@/components/ui/AutoLoadMore";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/routes";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { useListingCategories } from "@/lib/hooks/useCategories";
import type { Ad } from "@/lib/mock";
import { cn } from "@/lib/utils";

import i18n from "@/lib/i18n";
import { absoluteUrl } from "@/lib/seo/head";
import { parseTaxonomyId } from "@/lib/taxonomy";
import { catalogNamesFromIds, findSubcategoryByName, parseCatalogId } from "@/lib/catalog-filter";
import { reportActionFailure, reportReadFailure } from "@/lib/errors/handle";
import { AdsPageSkeleton } from "@/components/boot/PageSkeletons";
import { RouteErrorState } from "@/components/layout/RouteErrorState";

// Fetched in batches via per_page/page instead of all at once — keeps the
// initial catalog payload light (perf, especially on weak mobile networks).
const PAGE_SIZE = 24;

/**
 * Что было догружено — чтобы «Назад» с карточки объявления возвращал список,
 * а не его первую страницу. Решение Е5 требует именно этого.
 *
 * Пишется и читается ТОЛЬКО В БРАУЗЕРЕ. Процесс Node живёт сутками, и
 * модульное состояние на сервере копилось бы между запросами: один посетитель
 * получил бы догруженное другим. Это та самая грабля, на которой 14.09 падала
 * страница канала после страницы сообщества.
 *
 * Ключ — те же `buildParams`, что уходят в запрос: другой отбор это другой
 * список, и подменять его чужим нельзя.
 */
const догруженное = new Map<string, { ads: Ad[]; page: number; hasMore: boolean }>();

function запомнить(ключ: string, значение: { ads: Ad[]; page: number; hasMore: boolean }): void {
  if (typeof window === "undefined") return;
  /* Один отбор за раз: держать историю всех отборов незачем, а памяти она
     стоит столько же, сколько сами карточки. */
  догруженное.clear();
  догруженное.set(ключ, значение);
}

export const Route = createFileRoute("/ads/")({
  errorComponent: RouteErrorState,
  head: () => ({
    meta: [
      { title: i18n.t("pages.ads.metaTitle") },
      { name: "description", content: i18n.t("pages.ads.metaDescription") },
    ],
    // Канонический адрес — без параметров поиска и отбора: тот же
    // список в другом порядке новой страницей не является.
    links: [{ rel: "canonical", href: absoluteUrl("/ads") }],
  }),
  validateSearch: (
    search: Record<string, unknown>,
  ): { q?: string; taxonomy_id?: number; category_id?: number; subcategory_id?: number } => ({
    q: typeof search.q === "string" ? search.q : undefined,
    taxonomy_id: parseTaxonomyId(search.taxonomy_id),
    category_id: parseCatalogId(search.category_id),
    subcategory_id: parseCatalogId(search.subcategory_id),
  }),
  loaderDeps: ({ search }) => ({
    q: search.q,
    taxonomy_id: search.taxonomy_id,
    category_id: search.category_id,
    subcategory_id: search.subcategory_id,
  }),
  loader: async ({ deps }) => {
    await ensurePublicBootstrap();
    const ads = await fetchListings({
      q: deps.q,
      taxonomyId: deps.taxonomy_id,
      categoryId: deps.category_id,
      subcategoryId: deps.subcategory_id,
      sort: "new",
      perPage: PAGE_SIZE,
      page: 1,
    }).catch(() => [] as Ad[]);
    void prefetchCategoryRoomStats();
    return { ads };
  },
  staleTime: 30_000,
  pendingComponent: AdsPageSkeleton,
  component: CatalogPage,
});

type LoadState = "idle" | "loading" | "ok" | "error";

function countActiveFilters(f: FiltersState): number {
  let n = 0;
  if (f.category !== "Все") n++;
  if (f.city) n++;
  if (f.priceMin > 0) n++;
  if (f.priceMax < 100000) n++;
  return n;
}

function buildParams(
  q: string,
  filters: FiltersState,
  sort: SortKey,
  taxonomyId?: number,
  categoryId?: number,
  subcategoryId?: number,
): CatalogParams {
  return {
    q: q || undefined,
    taxonomyId,
    categoryId,
    subcategoryId,
    cityId: filters.cityId,
    cityName: filters.city || undefined,
    categoryName: filters.category !== "Все" ? filters.category : undefined,
    subcategoryName: filters.subcategory !== "Все" ? filters.subcategory : undefined,
    priceMin: filters.priceMin > 0 ? filters.priceMin : undefined,
    priceMax: filters.priceMax < 100000 ? filters.priceMax : undefined,
    deliveries: filters.deliveries.length ? filters.deliveries : undefined,
    sort,
  };
}

function CatalogPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const search = Route.useSearch();
  const loaded = Route.useLoaderData();
  const listingCategories = useListingCategories();
  const taxonomyId = search.taxonomy_id;
  const { guardAction } = useGuestAccess();

  const [ads, setAds] = useState<Ad[]>(() => loaded.ads);
  const [loadState, setLoadState] = useState<LoadState>("ok");
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isPendingRefresh, setIsPendingRefresh] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(() => loaded.ads.length === PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  /* Догрузка не удалась: вместо сторожа показываем «Повторить». Без этого
     состояния отказ гасил догрузку навсегда (`setHasMore(false)`), и
     человеку оставался подвал без всякого объяснения. */
  const [moreFailed, setMoreFailed] = useState(false);
  /* Сколько прибавилось последней страницей — только для диктора. */
  const [addedLast, setAddedLast] = useState(0);
  /*
   * Какая страница уже заказана. Сторож может сообщить о себе дважды за
   * кадр (наблюдатель пересоздаётся, пока страница едет), и одного
   * `loadingMore` мало: он поднимается уже внутри `loadMore`, а два вызова
   * в одном кадре увидят прежнее `false` оба.
   */
  const заказано = useRef(1);
  const [q, setQ] = useState(search.q ?? "");
  const [resultsMinHeight, setResultsMinHeight] = useState<number | undefined>(undefined);
  const resultsWrapRef = useRef<HTMLDivElement>(null);
  const hasLoadedOnce = useRef(true);
  /*
   * Поколение выдачи — ключ сетки.
   *
   * Карточки шли с key={ad.id}, и после фильтра подходящая карточка
   * оставалась тем же элементом и ехала вверх на место выпавших: Δy −241 и
   * −483 на 375. Ответ приходит через ~730 мс после ввода — позже 500 мс,
   * которые браузер прощает после действия, — и сдвиг считался: CLS 0,26 на
   * 375 и 0,063 на 1440 (замер 11.09 на боевых данных).
   *
   * Новая выдача — новое поколение: сетка монтируется заново, карточки
   * вставляются, а не сдвигаются, и вставка в CLS не входит. Ключ растёт по
   * ответу, а не по вводу: иначе сетка пересобиралась бы на каждой букве
   * ещё со старыми карточками. «Показать ещё» поколение не меняет —
   * догруженное дописывается к показанному.
   */
  const [resultGen, setResultGen] = useState(0);

  useEffect(() => {
    setQ(search.q ?? "");
  }, [search.q]);
  const [sort, setSort] = useState<SortKey>("new");
  /*
   * Раздел из адреса. Дерево каталога приходит с `/public/bootstrap`, который
   * загрузчик маршрута дожидается до отрисовки, — поэтому названия известны
   * уже в первом кадре и одинаковы на сервере и в браузере. Подставлять их
   * позже нельзя: смена `filters` после монтирования запускает повторный
   * запрос с теми же параметрами и пересборку сетки.
   */
  const [filters, setFilters] = useState<FiltersState>(() => {
    const named = catalogNamesFromIds(listingCategories, search.category_id, search.subcategory_id);
    return named ? { ...DEFAULT_FILTERS, ...named } : DEFAULT_FILTERS;
  });
  const [sheetOpen, setSheetOpen] = useState(false);

  /*
   * Выбранный слева раздел уходит в запрос как category_id/subcategory_id.
   *
   * Раньше он не уходил никак: `fetchListings` клал в query только q,
   * taxonomy_id, город, цену и сортировку, а имена разделов принимались
   * типом и молча терялись. Выбор категории менял фишку над списком и не
   * менял список — «Найдено: 6» на любой категории.
   *
   * Не taxonomy_id: у объявлений он означает раздел ленты и переводится
   * через зеркало, а слева выбирается раздел каталога. Правая панель
   * подставляла туда каталожный идентификатор и получала пустой список —
   * то есть не работала тоже.
   */
  const { categoryId, subcategoryId } = useMemo(() => {
    const cat = listingCategories.find((c) => c.name === filters.category);
    if (!cat) {
      /*
       * Дерево не знает этого раздела — берём идентификатор прямо из адреса.
       *
       * Отбор проходит путь «идентификатор из адреса → имя раздела →
       * обратно в идентификатор». Средним звеном служит дерево каталога из
       * `/public/bootstrap`, и оно строится не из `listing_categories`
       * напрямую, а из «видимых зеркал» направлений
       * (`CategoryTaxonomyService::visibleMirrorIds`). Если зеркал нет,
       * дерево пустое — и имя не находится ни для какого идентификатора.
       *
       * Дальше отбор просто **терялся молча**: `/ads?category_id=1`
       * открывался, в адресе отбор стоял, в панели значилось «Все», а в
       * запрос к API `category_id` не уходил вовсе. Человек видел не то,
       * что в адресе, и ничто об этом не сообщало. Под это же попадали
       * крошки на странице объявления — они ведут ровно на такой адрес.
       *
       * Замер 06.10 на стенде: 30 направлений, у всех `in_listings`, ни у
       * одного нет `listing_category_id`; `listing_categories` в ответе
       * `bootstrap` — ноль элементов. API при этом параметр понимает:
       * `category_id=1` даёт одно объявление, `category_id=999` — ноль.
       *
       * Поэтому источником правды остаётся адрес: имена нужны панели для
       * показа, а запросу достаточно идентификатора. Подстановка работает
       * только пока человек не выбрал раздел сам — иначе из адреса пришло
       * бы устаревшее значение.
       */
      const разделИзАдреса =
        filters.category === DEFAULT_FILTERS.category ? search.category_id : undefined;
      if (разделИзАдреса === undefined) return { categoryId: undefined, subcategoryId: undefined };
      return {
        categoryId: разделИзАдреса,
        subcategoryId:
          filters.subcategory === DEFAULT_FILTERS.subcategory ? search.subcategory_id : undefined,
      };
    }
    // По всему поддереву: дерево трёхуровневое, и подраздел может лежать
    // под своим разделом, а не рядом с ним.
    const sub = findSubcategoryByName(cat, filters.subcategory);
    const num = (v: string | undefined) => {
      const n = Number(v);
      return Number.isFinite(n) && n > 0 ? n : undefined;
    };
    return { categoryId: num(cat.id), subcategoryId: num(sub?.id) };
  }, [
    listingCategories,
    filters.category,
    filters.subcategory,
    search.category_id,
    search.subcategory_id,
  ]);

  const activeFilterCount = useMemo(() => countActiveFilters(filters), [filters]);

  const isFilterBusy = isRefreshing || isPendingRefresh;

  const load = useCallback(async () => {
    const refreshing = hasLoadedOnce.current;
    if (refreshing) {
      setIsRefreshing(true);
    } else {
      setLoadState("loading");
    }
    try {
      const params = buildParams(q, filters, sort, taxonomyId, categoryId, subcategoryId);
      const result = await fetchListings({ ...params, perPage: PAGE_SIZE, page: 1 });
      setAds(result);
      setResultGen((g) => g + 1);
      setPage(1);
      заказано.current = 1;
      setMoreFailed(false);
      setAddedLast(0);
      setHasMore(result.length === PAGE_SIZE);
      setLoadState("ok");
      hasLoadedOnce.current = true;
    } catch (err) {
      if (!refreshing) {
        // Первая загрузка: показываем состояние с «Повторить» вместо списка.
        setLoadState("error");
        reportReadFailure(err, "каталог объявлений");
        return;
      }
      /*
       * Обновление не удалось — и об этом надо сказать.
       *
       * Стояло `if (!refreshing) setLoadState("error")`, то есть после
       * первой успешной загрузки **любой** отказ проглатывался целиком:
       * ни состояния, ни сообщения. Человек менял отбор или сортировку,
       * запрос падал, а на экране оставалась прежняя выдача — и читалась
       * она как ответ на новый отбор.
       *
       * Замер 06.10: каталог открыт, запрос к `/listings` оборван, выбрана
       * сортировка «Сначала дешевле» — на экране по-прежнему «Найдено: 1
       * объявление», сообщений ноль, кнопки «Повторить» нет.
       *
       * Прежнюю выдачу не стираем: она хотя бы настоящая, просто не та, о
       * которой просили. Но молчать нельзя — человек нажал и ждёт.
       */
      reportActionFailure(err, t("pages.ads.errorTitle"));
    } finally {
      setIsRefreshing(false);
      setIsPendingRefresh(false);
    }
    /*
     * `categoryId` и `subcategoryId` обязаны быть в зависимостях.
     *
     * Они участвуют в запросе, но раньше в списке не значились: `load`
     * пересобирался только при смене `q`, `filters`, `sort` и
     * `taxonomyId`. Раздел приходит ещё и из адреса, и при смене одного
     * лишь адреса (переход по крошке с одного раздела на другой) запрос
     * ушёл бы со старым идентификатором из замкнутого окружения.
     */
  }, [q, filters, sort, taxonomyId, categoryId, subcategoryId, t]);

  const loadMore = useCallback(async () => {
    if (loadingMore || !hasMore || moreFailed) return;
    const nextPage = page + 1;
    /*
     * Одну страницу — один раз. `loadingMore` поднимается уже внутри, и два
     * вызова в одном кадре прошли бы оба; `заказано` сравнивается до любого
     * await, то есть синхронно.
     */
    if (заказано.current >= nextPage) return;
    заказано.current = nextPage;
    setLoadingMore(true);
    try {
      const params = buildParams(q, filters, sort, taxonomyId, categoryId, subcategoryId);
      const result = await fetchListings({ ...params, perPage: PAGE_SIZE, page: nextPage });
      /*
       * Дописываем только то, чего на экране ещё нет.
       *
       * Сервер отдаёт страницу по смещению, а каталог живой: за время
       * листания объявление могло появиться или уехать, и тогда страницы
       * сдвигаются — одна и та же карточка приходит дважды. React на
       * повторяющийся `key` ругается в консоль, а человек видит дубль.
       */
      const ещё = result.length === PAGE_SIZE;
      setAds((prev) => {
        const было = new Set(prev.map((a) => a.id));
        const новые = result.filter((a) => !было.has(a.id));
        setAddedLast(новые.length);
        const итог = новые.length ? [...prev, ...новые] : prev;
        запомнить(ключЗапросаRef.current, { ads: итог, page: nextPage, hasMore: ещё });
        return итог;
      });
      setPage(nextPage);
      setHasMore(ещё);
    } catch (err) {
      /*
       * Догрузка не удалась. Список на экране цел, человек ничего не
       * нажимал — поэтому не окно с ошибкой, а строка и «Повторить» на
       * месте сторожа.
       *
       * РАНЬШЕ ЗДЕСЬ СТОЯЛО `setHasMore(false)`: догрузка выключалась
       * навсегда, и дальше каталога для человека просто не существовало —
       * ни объяснения, ни способа повторить.
       */
      заказано.current = page;
      setMoreFailed(true);
      reportReadFailure(err, "каталог объявлений, следующая страница");
    } finally {
      setLoadingMore(false);
    }
  }, [
    loadingMore,
    hasMore,
    moreFailed,
    page,
    q,
    filters,
    sort,
    taxonomyId,
    categoryId,
    subcategoryId,
  ]);

  // Debounced: `load` changes identity on every keystroke into text filters
  // (search query, city — CitySelect's own dropdown-suggestion debounce fires
  // separately and doesn't cover this). Without this, the whole grid
  // re-fetches and re-renders (loading skeleton flash) on every letter typed.
  // The very first load (mount) skips the debounce so the page doesn't sit
  // blank for 350ms before showing the loading skeleton.
  const isFirstLoad = useRef(true);
  const filterSnapshot = useRef({ q, filters, sort, taxonomyId });

  // Lock results height and show refresh UI immediately — debounce only the API call.
  useEffect(() => {
    if (isFirstLoad.current) return;
    const prev = filterSnapshot.current;
    const changed =
      prev.q !== q ||
      prev.sort !== sort ||
      prev.filters !== filters ||
      prev.taxonomyId !== taxonomyId;
    if (!changed) return;

    filterSnapshot.current = { q, filters, sort, taxonomyId };
    if (resultsWrapRef.current) {
      setResultsMinHeight(resultsWrapRef.current.offsetHeight);
    }
    setIsPendingRefresh(true);
  }, [q, filters, sort, taxonomyId]);

  /*
   * Запрос повторяется только при смене ПАРАМЕТРОВ, а не личности `load`.
   *
   * Эффект висел на `[load]`, а `load` пересобирается от `t`, `filters`,
   * `categoryId` и `subcategoryId` — и что-то из них меняется уже после
   * монтирования. Страж первого прогона (`isFirstLoad`) снимался на первом
   * же проходе, и следующая пересборка `load` уводила в сеть запрос с теми
   * же параметрами, какие загрузчик маршрута уже выполнил на сервере.
   *
   * С кнопкой «Показать ещё» это было только лишним запросом: человек ещё
   * ничего не нажал, терять было нечего. С автоподгрузкой — видимый дефект.
   * Замер 06.10, /ads, 360, три прогона подряд:
   *
   *   +1,6 с  page=2            сторож догрузил
   *   +1,9 с  page=3            сторож догрузил
   *   +1,95 с (без page)        ЛИШНИЙ повтор первой страницы
   *   +2,2 с  page=2            заново, потому что список сбросили
   *   +2,5 с  page=3            заново
   *
   * То есть список на глазах сжимался до 24 карточек и отрастал обратно, а
   * страницы 2 и 3 ехали по сети дважды.
   *
   * Ключ собирается из тех же `buildParams`, что уходят в запрос: сравнивать
   * что-то другое значило бы сравнивать не то, от чего зависит ответ.
   */
  const ключЗапроса = useMemo(
    () => JSON.stringify(buildParams(q, filters, sort, taxonomyId, categoryId, subcategoryId)),
    [q, filters, sort, taxonomyId, categoryId, subcategoryId],
  );
  const прошлыйКлюч = useRef(ключЗапроса);
  /* Ключ нужен внутри `loadMore`, но в его зависимости не идёт: иначе
     обработчик пересобирался бы на каждую смену отбора и сторож успевал бы
     вызвать устаревший. */
  const ключЗапросаRef = useRef(ключЗапроса);
  ключЗапросаRef.current = ключЗапроса;

  /*
   * Возврат «Назад» с карточки объявления: восстанавливаем догруженное.
   *
   * `useLayoutEffect`, а не `useEffect`: высота списка должна вернуться до
   * отрисовки, иначе восстановление прокрутки роутером промахнётся — ему не
   * во что скроллить. На сервере этот эффект не выполняется вовсе, поэтому
   * первый кадр браузера совпадает с серверным: 24 карточки, как отдал
   * загрузчик, и только потом разворот.
   */
  useLayoutEffect(() => {
    const сохранённое = догруженное.get(ключЗапроса);
    if (!сохранённое || сохранённое.ads.length <= ads.length) return;
    setAds(сохранённое.ads);
    setPage(сохранённое.page);
    setHasMore(сохранённое.hasMore);
    заказано.current = сохранённое.page;
    // Один раз на монтирование: дальше список ведёт себя обычно.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (isFirstLoad.current) {
      isFirstLoad.current = false;
      filterSnapshot.current = { q, filters, sort, taxonomyId };
      прошлыйКлюч.current = ключЗапроса;
      return;
    }
    if (прошлыйКлюч.current === ключЗапроса) return;
    прошлыйКлюч.current = ключЗапроса;
    const timer = setTimeout(() => {
      void load();
    }, 350);
    return () => clearTimeout(timer);
  }, [ключЗапроса, load]);

  useLayoutEffect(() => {
    if (!isFilterBusy) {
      setResultsMinHeight(undefined);
    }
  }, [ads, isFilterBusy]);

  function resetFilters() {
    setFilters(DEFAULT_FILTERS);
    setQ("");
    setSort("new");
    if (taxonomyId) {
      navigate({ to: "/ads", search: { q: undefined, taxonomy_id: undefined }, replace: true });
    }
  }

  const hasAnyFilter = activeFilterCount > 0 || q;

  return (
    /*
      Правой панели здесь нет: она повторяла выбор категории, который уже
      делается фильтром слева. Две одинаковые точки выбора в одном экране
      расходятся в поведении — панель уводила на /ads?taxonomy_id=, фильтр
      менял состояние на месте, — и это два разных ответа на один вопрос.
    */
    // Левое меню свёрнуто в значки 64, как у Авито: сетке — всё место.
    <AppLayout footer navCollapsed>
      <div className="space-y-[16px] pb-[24px]">
        {/* Header */}
        <div className="flex items-start justify-between gap-[12px]">
          <div>
            <CatalogBreadcrumb
              category={filters.category}
              subcategory={filters.subcategory}
              onResetToRoot={() =>
                setFilters((p) => ({ ...p, category: "Все", subcategory: "Все" }))
              }
              onResetToCategory={() => setFilters((p) => ({ ...p, subcategory: "Все" }))}
            />
            <h1
              className="mt-[4px] font-display text-[22px] font-bold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              {t("pages.ads.title")}
            </h1>
            <p className="mt-[1px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.ads.subtitle")}
            </p>
          </div>
          <GuestGuardLink
            actionKey="layout.nav.ad_create"
            to={ROUTES.adCreate}
            className="inline-flex shrink-0 items-center gap-[6px] text-[13px] font-semibold"
            style={{
              height: 38,
              padding: "0 14px",
              borderRadius: "var(--r-button)",
              background: "var(--accent-fill)",
              color: "var(--accent-foreground)",
            }}
          >
            <Plus size={15} /> {t("pages.ads.create")}
          </GuestGuardLink>
        </div>

        {/* Content — persistent filter panel (xl+) + grid; drawer on <xl */}
        <div className="flex gap-[20px]">
          <AdFiltersPanel value={filters} onChange={setFilters} onReset={resetFilters} />
          <div className="min-w-0 flex-1 space-y-[12px]">
            {/* Sort bar */}
            <AdSortBar
              query={q}
              onQuery={setQ}
              sort={sort}
              onSort={setSort}
              onOpenFilters={() => setSheetOpen(true)}
              filterCount={activeFilterCount}
            />

            {/*
              Ряд фишек держит высоту, даже когда пуст.

              Резерв убирался — рассуждение было, что сдвиг случается сразу
              после действия человека и в CLS не попадает. Замер показал
              обратное: при смене категории блок результатов уезжал вниз на
              38 px, и запись сдвига приходила с hadRecentInput = false, то
              есть считалась. Тридцать два пикселя пустоты стоят меньше, чем
              прыжок карточек под курсором при каждом выборе фильтра.

              С 11.09 пустым он не бывает: первым в нём стоит «Найдено: N»,
              фишки встают следом. Без фильтров полоса была пустой — 57 px
              между строкой сортировки и сеткой.
            */}
            <div className="flex min-h-[32px] flex-wrap items-center gap-[6px]">
              <AdFoundCount count={ads.length} refreshing={isFilterBusy} />
              {hasAnyFilter && (
                <>
                  {q && <FilterTag label={`«${q}»`} onRemove={() => setQ("")} />}
                  {filters.category !== "Все" && (
                    <FilterTag
                      label={filters.category}
                      onRemove={() =>
                        setFilters((p) => ({ ...p, category: "Все", subcategory: "Все" }))
                      }
                    />
                  )}
                  {filters.city && (
                    <FilterTag
                      label={filters.city}
                      onRemove={() => setFilters((p) => ({ ...p, city: "", cityId: undefined }))}
                    />
                  )}
                  {(activeFilterCount > 1 || (activeFilterCount === 1 && q)) && (
                    <button
                      type="button"
                      onClick={resetFilters}
                      className="inline-flex items-center gap-[4px] text-[11.5px] font-medium transition-colors"
                      style={{ color: "var(--accent)", padding: "0 4px" }}
                    >
                      <RotateCcw size={11} /> Сбросить всё
                    </button>
                  )}
                </>
              )}
            </div>

            {/* Results — keep the previous grid mounted while filters refresh to avoid layout jumps */}
            <div
              ref={resultsWrapRef}
              className="relative"
              style={resultsMinHeight ? { minHeight: resultsMinHeight } : undefined}
            >
              {isFilterBusy && (
                <div
                  className="pointer-events-none absolute inset-0 z-[2] flex items-start justify-center rounded-[var(--r-card)] pt-[72px]"
                  style={{ background: "color-mix(in oklab, var(--background) 55%, transparent)" }}
                  aria-live="polite"
                  aria-busy="true"
                >
                  <div
                    className="inline-flex items-center gap-[8px] rounded-full px-[14px] py-[8px] text-[13px] font-medium shadow-[var(--shadow-card)]"
                    style={{
                      background: "var(--background-elevated)",
                      color: "var(--foreground-70)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    <span
                      className="inline-block h-[14px] w-[14px] animate-spin rounded-full border-2 border-transparent"
                      style={{ borderTopColor: "var(--accent)", borderRightColor: "var(--accent)" }}
                    />
                    {t("pages.ads.refreshing")}
                  </div>
                </div>
              )}

              {loadState === "loading" && !hasLoadedOnce.current && (
                <div className={CATALOG_GRID}>
                  {Array.from({ length: 12 }).map((_, i) => (
                    <CatalogCardSkeleton key={i} />
                  ))}
                </div>
              )}

              {loadState === "error" && !hasLoadedOnce.current && (
                <div
                  className="flex flex-col items-center gap-[12px] rounded-[var(--r-card)] border py-[48px] text-center"
                  style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
                >
                  <AlertCircle size={32} style={{ color: "var(--error)" }} />
                  <p className="text-[14px]" style={{ color: "var(--foreground-70)" }}>
                    {t("pages.ads.errorTitle")}
                  </p>
                  <Button variant="outline" onClick={() => void load()}>
                    <RefreshCw size={14} className="mr-[6px]" /> {t("pages.ads.retry")}
                  </Button>
                </div>
              )}

              {(loadState === "ok" || (loadState === "loading" && hasLoadedOnce.current)) &&
                ads.length === 0 &&
                !isFilterBusy && (
                  <EmptyState
                    icon={Megaphone}
                    title={
                      hasAnyFilter ? t("pages.ads.emptyTitle") : t("pages.ads.emptyCatalogTitle")
                    }
                    description={
                      hasAnyFilter ? t("pages.ads.emptyDesc") : t("pages.ads.emptyCatalogDesc")
                    }
                  >
                    {hasAnyFilter ? (
                      <Button variant="outline" onClick={resetFilters}>
                        <RotateCcw size={14} className="mr-[6px]" /> {t("pages.ads.resetFilters")}
                      </Button>
                    ) : (
                      <Button
                        onClick={() =>
                          guardAction(
                            "layout.nav.ad_create",
                            () => navigate({ to: ROUTES.adCreate }),
                            ROUTES.adCreate,
                          )
                        }
                      >
                        <Plus size={14} className="mr-[6px]" /> {t("pages.ads.postListing")}
                      </Button>
                    )}
                  </EmptyState>
                )}

              {isFilterBusy && ads.length === 0 && (
                <div className={CATALOG_GRID}>
                  {Array.from({ length: 8 }).map((_, i) => (
                    <CatalogCardSkeleton key={i} />
                  ))}
                </div>
              )}

              {ads.length > 0 && (
                <>
                  <div
                    key={resultGen}
                    className={cn(
                      CATALOG_GRID,
                      "transition-opacity duration-200",
                      isFilterBusy && "pointer-events-none opacity-[0.72]",
                    )}
                  >
                    {ads.map((ad, i) => (
                      <CatalogCard
                        key={ad.id}
                        ad={ad}
                        // Первый экран: на 375 в ряду две карточки, на широком
                        // — четыре. Приоритет отдаём первой паре: LCP-элемент
                        // на замерах — вторая карточка, а «высокий» на всём
                        // ряду перестаёт быть приоритетом.
                        priority={i < 2 ? "high" : i < 4 ? "eager" : undefined}
                      />
                    ))}
                  </div>
                  {/*
                    Догрузка сама — решение Е5. Кнопка осталась только
                    запасным ходом при отказе: она внутри `AutoLoadMore`.

                    Условие то же, что было у кнопки: пока идёт смена
                    отбора, сторож не рисуется — иначе он сообщил бы о себе
                    поверх уже заказанной первой страницы.
                  */}
                  {loadState === "ok" && !isFilterBusy && (
                    <AutoLoadMore
                      hasMore={hasMore}
                      loading={loadingMore}
                      failed={moreFailed}
                      onLoad={() => void loadMore()}
                      onRetry={() => {
                        setMoreFailed(false);
                        void loadMore();
                      }}
                      skeletons={
                        <div className={cn(CATALOG_GRID, "mt-[16px]")}>
                          {Array.from({ length: 4 }).map((_, i) => (
                            <CatalogCardSkeleton key={i} />
                          ))}
                        </div>
                      }
                      announcement={
                        addedLast > 0
                          ? t("components.autoLoadMore.added", {
                              added: addedLast,
                              total: ads.length,
                            })
                          : ""
                      }
                    />
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Mobile filter sheet */}
        <AdFiltersSheet
          open={sheetOpen}
          onClose={() => setSheetOpen(false)}
          value={filters}
          onChange={setFilters}
          onReset={() => {
            resetFilters();
            setSheetOpen(false);
          }}
        />
      </div>
    </AppLayout>
  );
}

function FilterTag({ label, onRemove }: { label: string; onRemove: () => void }) {
  const { t } = useTranslation();
  return (
    <span
      className="inline-flex items-center gap-[4px] text-[12px] font-medium"
      style={{
        height: 26,
        padding: "0 8px 0 10px",
        borderRadius: "var(--r-pill)",
        background: "var(--accent-soft)",
        color: "var(--accent)",
        border: "1px solid var(--border-accent)",
      }}
    >
      {label}
      <button
        type="button"
        onClick={onRemove}
        aria-label={t("pages.shared.removeFilter", { label })}
        className="grid place-items-center rounded-full transition-colors hover:bg-[color:var(--accent)]"
        style={{ width: 16, height: 16, color: "inherit" }}
      >
        <X size={10} />
      </button>
    </span>
  );
}
