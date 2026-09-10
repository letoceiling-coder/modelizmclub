import { createFileRoute, Link, redirect } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, MessageCircle, Search, Tag, Users } from "lucide-react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import type { Category, CategoryChild } from "@/lib/mock";
import { usePostCategories } from "@/lib/hooks/useCategories";
import {
  ROOM_TABS,
  SubcategoryRoomPage,
  type RoomTab,
} from "@/components/categories/SubcategoryRoomPage";
import { CategoryIcon, IconBox } from "@/components/ui/Icon";
import {
  membersForSubcategory,
  onlineForSubcategory,
  useCategoryRoomStats,
} from "@/lib/hooks/useCategoryRoomStats";

import i18n from "@/lib/i18n";
import { RouteErrorState } from "@/components/layout/RouteErrorState";

export const Route = createFileRoute("/categories/$id/")({
  errorComponent: RouteErrorState,
  /*
   * Вкладку комнаты держит адрес, а не состояние страницы. Иначе ссылка
   * «открыть чат» открывала бы то, что стоит вкладкой по умолчанию, а по
   * умолчанию теперь стоят записи.
   *
   * Направление вкладок не имеет, лишний параметр ему не мешает.
   */
  validateSearch: (search: Record<string, unknown>): { tab?: RoomTab } => ({
    tab: ROOM_TABS.includes(search.tab as RoomTab) ? (search.tab as RoomTab) : undefined,
  }),
  /*
   * Адрес направления — /categories/{slug}. Числовой id остаётся рабочим
   * ради старых ссылок: уведомлений, закладок, внешних переходов, — но не
   * рисует страницу, а отвечает постоянной переадресацией. Два адреса у
   * одной страницы означают две строки в поиске и в отчётах.
   *
   * 301, а не клиентский переход: адрес сменился насовсем, и поисковику
   * надо сказать об этом кодом, а не заменой истории в браузере.
   */
  beforeLoad: async ({ params }) => {
    if (!/^\d+$/.test(params.id)) return;
    const { resolveCategory } = await import("@/lib/api/categories");
    const found = await resolveCategory(params.id);
    if (!found || found.slug === params.id) return;
    throw redirect({ to: "/categories/$id", params: { id: found.slug }, code: 301 });
  },
  /*
   * Один адрес на направление и комнату — значит и один заголовок вкладки.
   * Ставить в него «Направление» на странице комнаты было бы неверно, а
   * выбирать из двух слов нечем: маршрут не знает, что за узел он открыл.
   * Поэтому заголовок называет сам узел, а общее слово остаётся запасным —
   * для случая, когда дерево ещё не приехало или узла нет.
   */
  loader: async ({ params }) => {
    const { resolveCategory } = await import("@/lib/api/categories");

    return { name: (await resolveCategory(params.id))?.name ?? null };
  },
  head: ({ loaderData }) => ({
    meta: [
      {
        title: loaderData?.name
          ? i18n.t("pages.categoryDetail.metaTitleNamed", { name: loaderData.name })
          : i18n.t("pages.categoryDetail.metaTitle"),
      },
    ],
  }),
  component: DirectionOrRoomPage,
});

/**
 * Один адрес, две страницы. Направление и комната различаются глубиной узла
 * в дереве, а не длиной адреса: комната жила на `/categories/{id}/{subId}`,
 * где второй сегмент лишь повторял то, что и так известно из дерева, а
 * первый заставлял помнить родителя, чтобы сослаться на ребёнка.
 *
 * Пока дерево не приехало, `categories` пуст, узел не находится, и
 * управление уходит в комнату — она сама покажет «загружаем». Тяжёлого при
 * этом не монтируется: чат и вкладки живут за проверкой «нашлась комната».
 */
function DirectionOrRoomPage() {
  const { id } = Route.useParams();
  const { tab } = Route.useSearch();
  const navigate = Route.useNavigate();
  const categories = usePostCategories();
  const direction = categories.find((x) => x.slug === id || x.id === id);

  if (direction) return <CategoryRoomsPage category={direction} />;

  return (
    <SubcategoryRoomPage
      roomKey={id}
      tab={tab ?? "posts"}
      // replace: переключение вкладок не должно копиться в истории — «назад»
      // из комнаты возвращает туда, откуда в неё пришли.
      onTabChange={(next) =>
        navigate({ search: { tab: next === "posts" ? undefined : next }, replace: true })
      }
    />
  );
}

function seedFrom(s: string): number {
  return s.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
}

function flattenRooms(nodes: CategoryChild[], depth = 0): { node: CategoryChild; depth: number }[] {
  return nodes.flatMap((node) => [
    { node, depth },
    ...flattenRooms(node.children ?? [], depth + 1),
  ]);
}

const ROOM_PREVIEW_KEYS = [
  "roomPreview0",
  "roomPreview1",
  "roomPreview2",
  "roomPreview3",
  "roomPreview4",
  "roomPreview5",
  "roomPreview6",
  "roomPreview7",
] as const;

function CategoryRoomsPage({ category: c }: { category: Category }) {
  const { t } = useTranslation();
  // Статистика комнат ходит в API по числовому id направления, не по слугу.
  const roomStats = useCategoryRoomStats(c.id);
  const [query, setQuery] = useState("");

  // Rooms live on levels 2 and 3 — a flat, indented list keeps «Ил-6»-style
  // third-level rooms reachable without an extra page.
  const filteredSubs = useMemo(() => {
    const q = query.trim().toLowerCase();
    const flat = flattenRooms(c.subcategories);
    if (!q) return flat;
    return flat.filter(({ node }) => node.name.toLowerCase().includes(q));
  }, [c, query]);

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-[14px]">
        <Breadcrumbs
          items={[
            { label: t("pages.categoryDetail.breadcrumbs"), to: "/categories" },
            { label: c.name },
          ]}
        />
        <header
          className="rounded-[var(--r-card)] border p-[16px]"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-[10px]">
            <Link
              to="/feed"
              aria-label={t("pages.categoryDetail.backAria")}
              className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] transition-colors hover:bg-[var(--background-surface)]"
            >
              <ArrowLeft className="h-[16px] w-[16px]" style={{ color: "var(--foreground-70)" }} />
            </Link>
            <span
              className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px]"
              style={{ background: "var(--background-surface)", color: "var(--accent)" }}
            >
              <IconBox size="md" variant="none" className="h-[42px] w-[42px]">
                <CategoryIcon categoryId={c.id} name={c.icon} iconImageUrl={c.iconImageUrl} fill />
              </IconBox>
            </span>
            <div className="min-w-0 flex-1">
              <h1
                className="truncate text-[18px] font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
              >
                {c.name}
              </h1>
              <p className="truncate text-[12.5px]" style={{ color: "var(--foreground-50)" }}>
                {c.description} ·{" "}
                {t("pages.shared.members", {
                  count: c.members,
                  formatted: c.members.toLocaleString("ru"),
                })}
              </p>
            </div>
          </div>
        </header>

        <div
          className="rounded-[var(--r-card)] border px-[14px] py-[10px]"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
        >
          <div
            className="flex items-center gap-[10px] rounded-[10px] border px-[12px] py-[8px]"
            style={{ background: "var(--background-surface)", borderColor: "var(--border)" }}
          >
            <Search
              className="h-[16px] w-[16px] shrink-0"
              style={{ color: "var(--foreground-50)" }}
            />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("pages.categoryDetail.searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--foreground-50)]"
              style={{ color: "var(--foreground)" }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="grid h-[22px] w-[22px] place-items-center rounded-full transition-colors"
                style={{ background: "var(--background-elevated)", color: "var(--foreground-50)" }}
                aria-label={t("pages.categoryDetail.clearAria")}
              >
                ×
              </button>
            )}
          </div>
        </div>

        <section
          className="overflow-hidden rounded-[var(--r-card)] border"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
        >
          <div
            className="flex items-center justify-between border-b px-[16px] py-[12px]"
            style={{ borderColor: "var(--border)" }}
          >
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
              {t("pages.categoryDetail.roomsHeading")}
            </h2>
            <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {filteredSubs.length}
            </span>
          </div>

          <ul>
            {filteredSubs.map(({ node: s, depth }, i) => {
              const online = onlineForSubcategory(roomStats, s.id);
              const members = membersForSubcategory(roomStats, s.id);
              const adsCount = 0;
              const previewKey =
                ROOM_PREVIEW_KEYS[(seedFrom(c.id + s.id) + i) % ROOM_PREVIEW_KEYS.length];
              const preview = t(`pages.categoryDetail.${previewKey}`);
              return (
                <li
                  key={s.id}
                  className="border-t first:border-t-0"
                  style={{ borderColor: "var(--border)" }}
                >
                  <Link
                    to="/categories/$id"
                    params={{ id: s.slug ?? s.id }}
                    className="flex items-center gap-[12px] py-[12px] pr-[16px] transition-colors hover:bg-[var(--background-surface)] focus-visible:outline focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-[var(--accent)]"
                    // Шестнадцать на уровень — столько же, сколько в правой
                    // панели: один и тот же список в двух местах не должен
                    // отступать по-разному.
                    style={{ paddingLeft: 16 + depth * 16 }}
                  >
                    <span
                      className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[12px] text-[14px] font-semibold"
                      style={{ background: "var(--background-surface)", color: "var(--accent)" }}
                    >
                      #
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-[8px]">
                        <span
                          className="truncate text-[14.5px] font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          {s.name}
                        </span>
                        <span
                          className="inline-flex shrink-0 items-center gap-[4px] text-[11px]"
                          style={{ color: "var(--foreground-50)" }}
                        >
                          <span
                            className="inline-block h-[6px] w-[6px] rounded-full"
                            style={{ background: "#22c55e" }}
                          />
                          {online}
                        </span>
                      </div>
                      <p
                        className="mt-[2px] truncate text-[12.5px]"
                        style={{ color: "var(--foreground-50)" }}
                      >
                        {preview}
                      </p>
                      <div
                        className="mt-[4px] flex items-center gap-[10px] text-[11px]"
                        style={{ color: "var(--foreground-50)" }}
                      >
                        <span className="inline-flex items-center gap-[3px]">
                          <Users className="h-[11px] w-[11px]" /> {members}
                        </span>
                        <span className="inline-flex items-center gap-[3px]">
                          <Tag className="h-[11px] w-[11px]" /> {adsCount}
                        </span>
                        <span className="inline-flex items-center gap-[3px]">
                          <MessageCircle className="h-[11px] w-[11px]" />{" "}
                          {t("pages.categoryDetail.chatLabel")}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className="h-[16px] w-[16px] shrink-0"
                      style={{ color: "var(--foreground-50)" }}
                    />
                  </Link>
                </li>
              );
            })}
            {filteredSubs.length === 0 && (
              <li
                className="px-[16px] py-[24px] text-center text-[13px]"
                style={{ color: "var(--foreground-50)" }}
              >
                {t("pages.categoryDetail.noResults", { query })}
              </li>
            )}
          </ul>
        </section>

        <p className="px-[4px] text-[11.5px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.categoryDetail.footerNote")}
        </p>
      </div>
    </AppLayout>
  );
}
