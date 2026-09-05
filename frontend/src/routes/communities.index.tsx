import { createFileRoute, Link } from "@tanstack/react-router";
import { variantUrl } from "@/lib/media/variants";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import {
  Car,
  Plane,
  Ship,
  Send,
  Code2,
  Wrench,
  Cpu,
  BatteryCharging,
  Users,
  Search,
  Plus,
  RefreshCw,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { DirectionsRightRail } from "@/components/layout/DirectionsRightRail";
import {
  CommunityRow,
  CommunityRowSkeleton,
  viewerRole,
} from "@/components/communities/CommunityRow";
import { GuestSectionStub } from "@/components/access/GuestSectionStub";
import { useCurrentUser } from "@/lib/session";
import type { Community } from "@/lib/mock";
import { fetchCommunities } from "@/lib/api/communities";
import { ensurePublicBootstrap } from "@/lib/boot/applyPublicBootstrap";
import { prefetchCategoryRoomStats } from "@/lib/hooks/useCategoryRoomStats";
import { useDebounce } from "@/hooks/useDebounce";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { SearchInput } from "@/components/ui/search-input";
import { DeleteCommunityDialog } from "@/components/communities/DeleteCommunityDialog";

import i18n from "@/lib/i18n";
import { parseTaxonomyId } from "@/lib/taxonomy";

export const Route = createFileRoute("/communities/")({
  head: () => ({ meta: [{ title: i18n.t("pages.communities.metaTitle") }] }),
  validateSearch: (search: Record<string, unknown>): { taxonomy_id?: number } => ({
    taxonomy_id: parseTaxonomyId(search.taxonomy_id),
  }),
  loaderDeps: ({ search }) => ({ taxonomy_id: search.taxonomy_id }),
  loader: async ({ deps }) => {
    await ensurePublicBootstrap();
    const communities = await fetchCommunities(undefined, deps.taxonomy_id).catch(
      () => [] as Community[],
    );
    void prefetchCategoryRoomStats();
    return { communities };
  },
  staleTime: 30_000,
  component: CommunitiesPage,
});

function EmptyMy({ onSwitch }: { onSwitch: () => void }) {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Users}
      title={t("pages.communities.emptyMineTitle")}
      description={t("pages.communities.emptyMineDesc")}
      action={{ label: t("pages.communities.browseRecommended"), onClick: onSwitch }}
      variant="compact"
    />
  );
}

function EmptySearch() {
  const { t } = useTranslation();
  return (
    <EmptyState
      icon={Search}
      title={t("pages.shared.nothingFound")}
      description={t("pages.communities.emptySearchDesc")}
      variant="compact"
    />
  );
}

const SECTION_LIMIT = 6;

function CommunitySection({
  title,
  subtitle,
  items,
  onDeleted,
}: {
  title: string;
  subtitle?: string;
  items: Community[];
  onDeleted?: () => void;
}) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const visible = expanded ? items : items.slice(0, SECTION_LIMIT);
  const canExpand = items.length > SECTION_LIMIT;

  return (
    <section className="space-y-[12px]">
      <div className="flex items-end justify-between gap-[12px]">
        <div className="min-w-0">
          <h2
            className="flex items-center gap-[8px] font-display text-[20px] font-bold"
            style={{ color: "var(--foreground)" }}
          >
            {title}
            <span
              className="inline-flex h-[18px] min-w-[18px] items-center justify-center px-[6px] text-[11px] font-bold"
              style={{
                background: "var(--accent-soft)",
                color: "var(--accent)",
                borderRadius: "var(--r-pill)",
              }}
            >
              {items.length}
            </span>
          </h2>
          {subtitle && (
            <p className="mt-[2px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
              {subtitle}
            </p>
          )}
        </div>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 whitespace-nowrap text-[13px] font-semibold transition-colors hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            {expanded ? t("pages.shared.collapse") : t("pages.shared.showAll")}
          </button>
        )}
      </div>
      {/* Одна колонка на всех ширинах: центральная колонка держит 680 px, и
          две строки по 330 не оставили бы места ни названию, ни кнопке. */}
      <div className="flex flex-col gap-[8px]">
        {visible.map((c) => (
          <CommunityRow key={c.id} c={c} onChanged={onDeleted} />
        ))}
      </div>
    </section>
  );
}

function CommunitiesPage() {
  const { t } = useTranslation();
  const { taxonomy_id: taxonomyId } = Route.useSearch();
  const loaded = Route.useLoaderData();
  const [all, setAll] = useState<Community[]>(() => loaded.communities);
  const [loading, setLoading] = useState(() => loaded.communities.length === 0);
  // Четыре состояния списка: скелетон, ошибка с «Повторить», пусто, данные.
  // До 05.09 неудачная загрузка выглядела как «сообществ нет».
  const [loadFailed, setLoadFailed] = useState(false);
  const me = useCurrentUser();
  const isGuest = !me.id || me.id === "guest";
  const hasRowsRef = useRef(loaded.communities.length > 0);

  const primed = useRef(loaded.communities.length > 0);

  useEffect(() => {
    if (loaded.communities.length === 0) return;
    hasRowsRef.current = true;
    setAll(loaded.communities);
    setLoading(false);
  }, [loaded.communities]);

  useEffect(() => {
    if (primed.current) {
      primed.current = false;
      return;
    }
    let alive = true;
    if (!hasRowsRef.current) setLoading(true);
    fetchCommunities(undefined, taxonomyId)
      .then((rows) => {
        if (!alive) return;
        hasRowsRef.current = rows.length > 0;
        setAll(rows);
        setLoadFailed(false);
      })
      .catch(() => {
        if (alive) setLoadFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [taxonomyId]);

  const reloadCommunities = () => {
    setLoadFailed(false);
    fetchCommunities(undefined, taxonomyId)
      .then((rows) => {
        setAll(rows);
        setLoadFailed(false);
      })
      .catch(() => setLoadFailed(true));
  };

  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 250);

  const filtered = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    if (!q) return all;
    return all.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q) ||
        c.description.toLowerCase().includes(q),
    );
  }, [all, debounced]);

  // Sequential blocks: Мои (владелец/модератор) → Подписки (участник) → Рекомендованные.
  const mine = useMemo(
    () => filtered.filter((c) => viewerRole(c) === "owner" || viewerRole(c) === "moderator"),
    [filtered],
  );
  const subscriptions = useMemo(
    () => filtered.filter((c) => viewerRole(c) === "member"),
    [filtered],
  );
  const recommended = useMemo(() => filtered.filter((c) => !viewerRole(c)), [filtered]);

  const hasQuery = debounced.trim().length > 0;
  const nothing = filtered.length === 0;
  const noneJoined = mine.length === 0 && subscriptions.length === 0;

  return (
    <AppLayout narrowCenter rightColumn={<DirectionsRightRail variant="communities" />} footer>
      <div className="space-y-[24px]">
        {/* Заголовок и действие — одной строкой; пояснение уходит под
            заголовок в caption, а не занимает отдельную строку крупным
            текстом. Кнопка sm: 36 px, зона нажатия 44 через hit-target. */}
        <header className="flex items-start justify-between gap-[12px]">
          <div className="min-w-0">
            <h1
              className="font-display text-[28px] font-bold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              {t("pages.communities.title")}
            </h1>
            <p className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.communities.subtitle")}
            </p>
          </div>
          <Button asChild size="sm" className="shrink-0 gap-[6px]">
            <Link to="/communities/new">
              <Plus size={16} /> {t("pages.communities.createCommunity")}
            </Link>
          </Button>
        </header>

        {/* Search */}
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder={t("pages.communities.searchPlaceholder")}
        />

        {loading && all.length === 0 ? (
          <div className="flex flex-col gap-[8px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <CommunityRowSkeleton key={i} />
            ))}
          </div>
        ) : loadFailed ? (
          <EmptyState
            icon={RefreshCw}
            title={t("pages.communities.loadFailedTitle")}
            description={t("pages.communities.loadFailedDesc")}
            action={{ label: t("pages.shared.retry"), onClick: reloadCommunities }}
            variant="compact"
          />
        ) : nothing ? (
          hasQuery ? (
            <EmptySearch />
          ) : isGuest ? (
            // Гостю не сообщаем, что «у вас пока нет сообществ» — у него их и
            // не может быть; предлагаем войти.
            <GuestSectionStub
              icon={Users}
              title={t("guestAuth.communitiesTitle")}
              description={t("guestAuth.communitiesDesc")}
            />
          ) : (
            <EmptyMy
              onSwitch={() => {
                /* scroll handled naturally */
              }}
            />
          )
        ) : (
          <div className="space-y-[24px]">
            <CommunitySection
              title={t("pages.communities.sectionMine")}
              subtitle={t("pages.communities.sectionMineSub")}
              items={mine}
              onDeleted={reloadCommunities}
            />
            <CommunitySection
              title={t("pages.communities.sectionSubscriptions")}
              subtitle={t("pages.communities.sectionSubscriptionsSub")}
              items={subscriptions}
              onDeleted={reloadCommunities}
            />
            <CommunitySection
              title={t("pages.communities.sectionRecommended")}
              subtitle={
                noneJoined
                  ? t("pages.communities.sectionRecommendedSubNone")
                  : t("pages.communities.sectionRecommendedSub")
              }
              items={recommended}
              onDeleted={reloadCommunities}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
