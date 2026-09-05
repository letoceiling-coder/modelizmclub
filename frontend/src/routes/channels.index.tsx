import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";

import { useMemo, useState } from "react";

import { useTranslation } from "react-i18next";

import {
  Radio,
  Users,
  Check,
  BadgeCheck,
  Store,
  Briefcase,
  Sparkles,
  Settings2,
  BarChart2,
  MoreVertical,
  Trash2,
  Plus,
} from "lucide-react";

import { AppLayout } from "@/components/layout/AppLayout";
import { DirectionsRightRail } from "@/components/layout/DirectionsRightRail";

import {
  useChannels,
  setChannelSubscription,
  isChannelOwner,
  fetchChannels,
  formatCount,
  type Channel,
  type ChannelKind,
} from "@/lib/channels";

import { useCurrentUser } from "@/lib/session";

import { toast } from "@/lib/toast";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";

import { Button } from "@/components/ui/button";

import { SearchInput } from "@/components/ui/search-input";

import { EmptyState } from "@/components/ui/empty-state";

import { DeleteChannelDialog } from "@/components/channels/DeleteChannelDialog";
import { ChannelRow } from "@/components/channels/ChannelRow";
import { EntityRowSkeleton } from "@/components/entity/EntityRow";
import { useGate } from "@/lib/gate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

import { ensurePublicBootstrap } from "@/lib/boot/applyPublicBootstrap";
import { prefetchCategoryRoomStats } from "@/lib/hooks/useCategoryRoomStats";

import i18n from "@/lib/i18n";
import { parseTaxonomyId } from "@/lib/taxonomy";

export const Route = createFileRoute("/channels/")({
  head: () => ({
    meta: [
      { title: i18n.t("pages.channels.metaTitle") },
      { name: "description", content: i18n.t("pages.channels.metaDescription") },
    ],
  }),
  validateSearch: (search: Record<string, unknown>): { taxonomy_id?: number } => ({
    taxonomy_id: parseTaxonomyId(search.taxonomy_id),
  }),
  loaderDeps: ({ search }) => ({ taxonomy_id: search.taxonomy_id }),
  loader: async ({ deps }) => {
    await ensurePublicBootstrap();
    const channels = await fetchChannels(deps.taxonomy_id).catch(() => []);
    void prefetchCategoryRoomStats();
    return { channels };
  },
  staleTime: 30_000,
  component: ChannelsPage,
});

const SECTION_LIMIT = 6;

function ChannelSection({
  title,

  subtitle,

  items,

  onChanged,
}: {
  title: string;

  subtitle?: string;

  items: Channel[];

  onChanged: () => void;
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

      {/* Одна колонка: центральная колонка держит 680, и две строки по 330 не
          оставили бы места ни названию, ни кнопке. */}
      <ul className="flex list-none flex-col gap-[8px]">
        {visible.map((c) => (
          <li key={c.id}>
            <ChannelRow channel={c} onChanged={onChanged} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function ChannelsPage() {
  const { t } = useTranslation();

  const gate = useGate();

  const { taxonomy_id: taxonomyId } = Route.useSearch();

  const loaded = Route.useLoaderData();

  const { channels: all, loading, reload } = useChannels(taxonomyId, loaded.channels);

  const me = useCurrentUser();

  const navigate = useNavigate();

  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const query = q.trim().toLowerCase();

    if (!query) return all;

    return all.filter(
      (c) => c.name.toLowerCase().includes(query) || c.description.toLowerCase().includes(query),
    );
  }, [all, q]);

  const mine = useMemo(
    () =>
      filtered
        .filter((c) => isChannelOwner(c, me.id))
        .sort((a, b) => a.name.localeCompare(b.name, "ru")),

    [filtered, me.id],
  );

  const hasOwnChannel = useMemo(() => all.some((c) => isChannelOwner(c, me.id)), [all, me.id]);

  const subscriptions = useMemo(
    () => filtered.filter((c) => c.isSubscribed && !isChannelOwner(c, me.id)),

    [filtered, me.id],
  );

  const catalog = useMemo(
    () => filtered.filter((c) => !isChannelOwner(c, me.id)),

    [filtered, me.id],
  );

  const popular = useMemo(
    () => [...catalog].sort((a, b) => b.subscribers - a.subscribers),

    [catalog],
  );

  const newest = useMemo(
    () => [...catalog].sort((a, b) => +new Date(b.createdAt) - +new Date(a.createdAt)),

    [catalog],
  );

  const nothing = filtered.length === 0;

  const hasQuery = q.trim().length > 0;

  return (
    <AppLayout narrowCenter rightColumn={<DirectionsRightRail variant="channels" />} footer>
      <div className="space-y-[24px]">
        <header className="flex items-start justify-between gap-[12px]">
          <div className="min-w-0">
            <h1
              className="truncate font-display text-[28px] font-bold leading-tight"
              style={{ color: "var(--foreground)" }}
            >
              {t("pages.channels.title")}
            </h1>

            <p className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
              {t("pages.channels.subtitle")}
            </p>
          </div>

          {/* Кнопка стоит всегда, как «Создать сообщество» в соседнем разделе.
              Без подтверждённого телефона она открывает окно верификации, а не
              уводит на страницу мастера, где раньше встречала заглушка. */}
          <Button
            type="button"
            size="sm"
            className="shrink-0 gap-[6px]"
            onClick={() => void gate.require("verified", () => navigate({ to: "/channels/new" }))}
          >
            <Plus size={16} /> {t("pages.channels.createChannel")}
          </Button>
        </header>

        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onClear={() => setQ("")}
          placeholder={t("pages.channels.searchPlaceholder")}
        />

        {loading ? (
          <div className="flex flex-col gap-[8px]">
            {Array.from({ length: 6 }).map((_, i) => (
              <EntityRowSkeleton key={i} />
            ))}
          </div>
        ) : nothing ? (
          <EmptyState
            icon={Radio}
            title={hasQuery ? t("pages.shared.nothingFound") : t("pages.channels.emptyTitle")}
            description={
              hasQuery ? t("pages.channels.emptySearchDesc") : t("pages.channels.emptyDesc")
            }
            action={
              !hasQuery
                ? {
                    label: t("pages.channels.createChannel"),
                    onClick: () => navigate({ to: "/channels/new" }),
                  }
                : undefined
            }
            variant="compact"
          />
        ) : (
          <div className="space-y-[24px]">
            <ChannelSection
              title={t("pages.channels.sectionMine")}
              subtitle={t("pages.channels.sectionMineSub")}
              items={mine}
              onChanged={reload}
            />

            <ChannelSection
              title={t("pages.channels.sectionSubscriptions")}
              subtitle={t("pages.channels.sectionSubscriptionsSub")}
              items={subscriptions}
              onChanged={reload}
            />

            <ChannelSection
              title={t("pages.channels.sectionPopular")}
              subtitle={t("pages.channels.sectionPopularSub")}
              items={popular}
              onChanged={reload}
            />

            <ChannelSection
              title={t("pages.channels.sectionNew")}
              subtitle={t("pages.channels.sectionNewSub")}
              items={newest}
              onChanged={reload}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
