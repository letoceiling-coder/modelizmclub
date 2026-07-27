import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Car, Plane, Ship, Send, Code2, Wrench, Cpu, BatteryCharging, Users, Search, ArrowRight, ImageOff,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Community } from "@/lib/mock";
import { fetchCommunities } from "@/lib/api/communities";
import { useDebounce } from "@/hooks/useDebounce";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { DeleteCommunityDialog } from "@/components/communities/DeleteCommunityDialog";

export const Route = createFileRoute("/communities/")({
  head: () => ({ meta: [{ title: "Сообщества — МоДелизМ" }] }),
  component: CommunitiesPage,
});

const ICON_MAP: Record<string, typeof Car> = {
  Car, Plane, Ship, Send, Code2, Wrench, Cpu, BatteryCharging,
};

const ROLE_LABEL: Record<NonNullable<Community["role"]>, string> = {
  owner: "Владелец",
  moderator: "Модератор",
  member: "Участник",
};

function resolveRole(c: Community): Community["role"] | undefined {
  if (c.role) return c.role;
  if (c.isOwner) return "owner";
  if (c.joined) return "member";
  return undefined;
}

function CommunityCard({ c, onDeleted }: { c: Community; onDeleted?: () => void }) {
  const Icon = ICON_MAP[c.avatarIcon ?? "Users"] ?? Users;
  const [brokenCover, setBrokenCover] = useState(false);
  const [brokenAvatar, setBrokenAvatar] = useState(false);

  const showCover = Boolean(c.coverImage) && !brokenCover;
  const showAvatar = Boolean(c.avatarImage) && !brokenAvatar;

  return (
    <Card
      className="overflow-hidden flex flex-col shadow-none"
      style={{ background: "var(--background)", borderColor: "var(--border)", borderRadius: 16 }}
    >
      {/* banner */}
      <Link to="/communities/$id" params={{ id: c.id }} className="relative block">
        {showCover ? (
          <img
            src={c.coverImage}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-[120px] w-full object-cover"
            onError={() => setBrokenCover(true)}
          />
        ) : (
          <div className="relative h-[120px] w-full overflow-hidden" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-muted))" }}>
            <div className="absolute inset-0 grid place-items-center opacity-25">
              <Icon size={54} color="#fff" />
            </div>
          </div>
        )}
        {/* category chip */}
        {c.category && (
          <span className="absolute right-[10px] top-[10px] rounded-full px-[10px] py-[3px] text-[11px] font-semibold text-white" style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(6px)" }}>
            {c.category}
          </span>
        )}
        {/* viewer role */}
        {(() => {
          const role = resolveRole(c);
          if (!role) return null;
          return (
            <span
              className="absolute left-[10px] top-[10px] rounded-full px-[10px] py-[3px] text-[11px] font-semibold"
              style={{
                background: role === "member" ? "rgba(0,0,0,0.5)" : "var(--accent)",
                color: "#fff",
                backdropFilter: "blur(6px)",
              }}
            >
              {ROLE_LABEL[role]}
            </span>
          );
        })()}
        {/* avatar */}
        <div
          className="absolute -bottom-[24px] left-[16px] grid h-[56px] w-[56px] place-items-center overflow-hidden"
          style={{ background: "var(--background)", border: "3px solid var(--background)", borderRadius: "var(--r-card)" }}
        >
          {showAvatar ? (
            <img
              src={c.avatarImage}
              alt=""
              loading="lazy"
              decoding="async"
              className="h-full w-full object-cover"
              onError={() => setBrokenAvatar(true)}
            />
          ) : (
            <div className="grid h-full w-full place-items-center" style={{ background: "var(--accent-soft)" }}>
              <Icon size={26} style={{ color: "var(--accent)" }} />
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-[10px] px-[16px] pt-[32px] pb-[16px]">
        <Link to="/communities/$id" params={{ id: c.id }} className="min-w-0">
          <h3 className="truncate font-display text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>
            {c.name}
          </h3>
          <p
            className="mt-[4px] text-[13px]"
            style={{
              color: "var(--foreground-70)",
              display: "-webkit-box",
              WebkitLineClamp: 2,
              WebkitBoxOrient: "vertical",
              overflow: "hidden",
            }}
          >
            {c.description}
          </p>
        </Link>
        <div className="mt-auto flex items-center justify-between gap-[8px] pt-[4px]">
          <div className="flex flex-col gap-[2px]">
            <span className="inline-flex items-center gap-[6px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
              <Users size={14} /> {c.members.toLocaleString("ru")} участников
            </span>
            <span className="inline-flex items-center gap-[6px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
              <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "#22c55e" }} />
              активны сегодня
            </span>
          </div>
          <div className="flex items-center gap-[6px]">
            {c.isOwner && onDeleted && (
              <DeleteCommunityDialog slug={c.id} name={c.name} onDeleted={onDeleted} compact />
            )}
            <Button asChild size="sm" className=" gap-[6px]">
              <Link to="/communities/$id" params={{ id: c.id }}>
                Перейти <ArrowRight size={14} />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </Card>
  );
}

function EmptyMy({ onSwitch }: { onSwitch: () => void }) {
  return (
    <EmptyState
      icon={Users}
      title="Вы пока не в одном сообществе"
      description="Посмотрите рекомендованные клубы, школы и магазины моделизма"
      action={{ label: "Смотреть рекомендованные", onClick: onSwitch }}
      variant="compact"
    />
  );
}

function EmptySearch() {
  return (
    <EmptyState
      icon={Search}
      title="Ничего не найдено"
      description="Попробуйте изменить запрос или поискать в другом разделе"
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
  const [expanded, setExpanded] = useState(false);
  if (items.length === 0) return null;
  const visible = expanded ? items : items.slice(0, SECTION_LIMIT);
  const canExpand = items.length > SECTION_LIMIT;

  return (
    <section className="space-y-[14px]">
      <div className="flex items-end justify-between gap-[12px]">
        <div className="min-w-0">
          <h2 className="flex items-center gap-[8px] font-display text-[18px] font-bold sm:text-[20px]" style={{ color: "var(--foreground)" }}>
            {title}
            <span
              className="inline-flex h-[22px] min-w-[22px] items-center justify-center px-[7px] text-[12px] font-bold"
              style={{ background: "var(--accent-soft)", color: "var(--accent)", borderRadius: "var(--r-pill)" }}
            >
              {items.length}
            </span>
          </h2>
          {subtitle && (
            <p className="mt-[2px] text-[13px]" style={{ color: "var(--foreground-50)" }}>{subtitle}</p>
          )}
        </div>
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="shrink-0 whitespace-nowrap text-[13px] font-semibold transition-colors hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            {expanded ? "Свернуть" : "Показать все"}
          </button>
        )}
      </div>
      <div className="grid gap-[16px] grid-cols-1 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((c) => (
          <CommunityCard key={c.id} c={c} onDeleted={onDeleted} />
        ))}
      </div>
    </section>
  );
}

function CommunitiesPage() {
  const [all, setAll] = useState<Community[]>([]);

  useEffect(() => {
    fetchCommunities().then(setAll).catch(() => {});
  }, []);

  const reloadCommunities = () => {
    fetchCommunities().then(setAll).catch(() => {});
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
    () => filtered.filter((c) => resolveRole(c) === "owner" || resolveRole(c) === "moderator"),
    [filtered],
  );
  const subscriptions = useMemo(
    () => filtered.filter((c) => resolveRole(c) === "member"),
    [filtered],
  );
  const recommended = useMemo(
    () => filtered.filter((c) => !resolveRole(c)),
    [filtered],
  );

  const hasQuery = debounced.trim().length > 0;
  const nothing = filtered.length === 0;
  const noneJoined = mine.length === 0 && subscriptions.length === 0;

  return (
    <AppLayout rightColumn={false} footer>
      <div className="space-y-[24px]">
        <header>
          <h1
            className="font-display text-[24px] font-bold sm:text-[28px]"
            style={{ color: "var(--foreground)" }}
          >
            Сообщества
          </h1>
          <p className="mt-[4px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
            Клубы, кружки, школы и магазины моделизма
          </p>
        </header>

        {/* Search */}
        <SearchInput
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onClear={() => setQuery("")}
          placeholder="Поиск по названию, категории или описанию"
        />

        {nothing ? (
          hasQuery ? <EmptySearch /> : <EmptyMy onSwitch={() => { /* scroll handled naturally */ }} />
        ) : (
          <div className="space-y-[28px]">
            <CommunitySection
              title="Мои сообщества"
              subtitle="Где вы владелец или модератор"
              items={mine}
              onDeleted={reloadCommunities}
            />
            <CommunitySection
              title="Мои подписки"
              subtitle="Сообщества, в которых вы состоите"
              items={subscriptions}
              onDeleted={reloadCommunities}
            />
            <CommunitySection
              title="Рекомендованные"
              subtitle={noneJoined ? "Подобрали клубы, школы и магазины моделизма" : "Подобрано по вашим интересам"}
              items={recommended}
              onDeleted={reloadCommunities}
            />
          </div>
        )}
      </div>
    </AppLayout>
  );
}
