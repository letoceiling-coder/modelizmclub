import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Car, Plane, Ship, Send, Code2, Wrench, Cpu, BatteryCharging, Users, Search, ArrowRight,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Community } from "@/lib/mock";
import { fetchCommunities } from "@/lib/api/communities";
import { useDebounce } from "@/hooks/useDebounce";
import { EmptyState } from "@/components/ui/empty-state";

export const Route = createFileRoute("/communities/")({
  head: () => ({ meta: [{ title: "Сообщества — МоДелизМ Форум" }] }),
  component: CommunitiesPage,
});

const ICON_MAP: Record<string, typeof Car> = {
  Car, Plane, Ship, Send, Code2, Wrench, Cpu, BatteryCharging,
};

function CommunityCard({ c }: { c: Community }) {
  const Icon = ICON_MAP[c.avatarIcon ?? "Users"] ?? Users;
  return (
    <article
      className="overflow-hidden flex flex-col"
      style={{ background: "var(--background)", border: "1px solid var(--border)", borderRadius: 16 }}
    >
      {/* banner */}
      <Link to="/communities/$id" params={{ id: c.id }} className="relative block">
        {c.coverImage ? (
          <img src={c.coverImage} alt="" className="h-[120px] w-full object-cover" />
        ) : (
          <div className="h-[120px] w-full" style={{ background: "linear-gradient(135deg, var(--accent), var(--accent-muted))" }} />
        )}
        {/* avatar */}
        <div
          className="absolute -bottom-[24px] left-[16px] grid h-[56px] w-[56px] place-items-center overflow-hidden"
          style={{ background: "var(--background)", border: "3px solid var(--background)", borderRadius: 14 }}
        >
          {c.avatarImage ? (
            <img src={c.avatarImage} alt="" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full w-full place-items-center" style={{ background: "var(--accent-soft)" }}>
              <Icon size={26} style={{ color: "var(--accent)" }} />
            </div>
          )}
        </div>
      </Link>

      <div className="flex flex-1 flex-col gap-[10px] px-[16px] pt-[32px] pb-[16px]">
        <Link to="/communities/$id" params={{ id: c.id }} className="min-w-0">
          <h3 className="truncate font-display text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>{c.name}</h3>
          <p className="mt-[4px] text-[13px]" style={{
            color: "var(--foreground-70)",
            display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical", overflow: "hidden",
          }}>
            {c.description}
          </p>
        </Link>
        <div className="mt-auto flex items-center justify-between gap-[8px] pt-[4px]">
          <span className="inline-flex items-center gap-[6px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            <Users size={14} /> {c.members.toLocaleString("ru")}
          </span>
          <Link
            to="/communities/$id"
            params={{ id: c.id }}
            className="inline-flex items-center gap-[6px] font-semibold transition-colors"
            style={{
              height: 34, padding: "0 14px", borderRadius: 10,
              background: "var(--accent)", color: "white", fontSize: 13,
            }}
          >
            Перейти <ArrowRight size={14} />
          </Link>
        </div>
      </div>
    </article>
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

function CommunitiesPage() {
  const [all, setAll] = useState<Community[]>([]);

  useEffect(() => {
    fetchCommunities().then(setAll).catch(() => {});
  }, []);

  const myCommunities = useMemo(() => all.filter((c) => c.joined), [all]);
  const recommended = useMemo(() => all.filter((c) => !c.joined), [all]);

  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 250);
  const [section, setSection] = useState<"my" | "recommended">("my");

  useEffect(() => {
    if (myCommunities.length === 0) setSection("recommended");
  }, [myCommunities.length]);

  const apply = (list: Community[]) => {
    const q = debounced.trim().toLowerCase();
    if (!q) return list;
    return list.filter((c) => c.name.toLowerCase().includes(q) || c.category.toLowerCase().includes(q) || c.description.toLowerCase().includes(q));
  };

  const myFiltered = useMemo(() => apply(myCommunities), [myCommunities, debounced]);
  const recFiltered = useMemo(() => apply(recommended), [recommended, debounced]);

  const visible = section === "my" ? myFiltered : recFiltered;
  const hasQuery = debounced.trim().length > 0;

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-[20px]">
        <header>
          <h1 className="font-display text-[24px] font-bold sm:text-[28px]" style={{ color: "var(--foreground)" }}>Сообщества</h1>
          <p className="mt-[4px] text-[14px]" style={{ color: "var(--foreground-50)" }}>Клубы, кружки, школы и магазины моделизма</p>
        </header>

        {/* Tabs */}
        <nav role="tablist" className="relative flex items-center gap-[4px] overflow-x-auto" style={{ borderBottom: "1px solid var(--border)" }}>
          {([
            { key: "my" as const, label: "Мои", count: myCommunities.length },
            { key: "recommended" as const, label: "Рекомендованные", count: recommended.length },
          ]).map((t) => {
            const active = section === t.key;
            return (
              <button
                key={t.key}
                role="tab"
                aria-selected={active}
                onClick={() => setSection(t.key)}
                className="relative inline-flex shrink-0 items-center gap-[8px] px-[16px] py-[12px] text-[14px] font-semibold transition-colors"
                style={{ color: active ? "var(--foreground)" : "var(--foreground-50)" }}
              >
                {t.label}
                <span
                  className="inline-flex h-[20px] min-w-[20px] items-center justify-center px-[6px] text-[11px] font-bold"
                  style={{
                    background: active ? "var(--accent-soft)" : "var(--background-surface)",
                    color: active ? "var(--accent)" : "var(--foreground-50)",
                    borderRadius: 999,
                  }}
                >
                  {t.count}
                </span>
                {active && (
                  <motion.span
                    layoutId="communities-tab-underline"
                    className="absolute bottom-[-1px] left-[8px] right-[8px]"
                    style={{ height: 3, background: "var(--accent)", borderRadius: 2 }}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
              </button>
            );
          })}
        </nav>

        {/* Search */}
        <div className="relative">
          <Search className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2" size={16} style={{ color: "var(--foreground-50)" }} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Поиск по названию, категории или описанию"
            className="w-full text-[14px] outline-none"
            style={{
              height: 44, paddingLeft: 38, paddingRight: 14,
              background: "var(--background-surface)", borderRadius: 12,
              border: "1.5px solid transparent", color: "var(--foreground)",
            }}
            onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
            onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
          />
        </div>

        {section === "my" && myCommunities.length === 0 && !hasQuery ? (
          <EmptyMy onSwitch={() => setSection("recommended")} />
        ) : visible.length === 0 ? (
          <EmptySearch />
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div key={section} className="grid gap-[16px] grid-cols-1 sm:grid-cols-2">
              {visible.map((c) => <CommunityCard key={c.id} c={c} />)}
            </motion.div>
          </AnimatePresence>
        )}
      </div>
    </AppLayout>
  );
}
