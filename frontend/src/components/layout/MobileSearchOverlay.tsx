import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  Search as SearchIcon, User as UserIcon, Users2, Megaphone, Compass, Clock, Clapperboard,
  type LucideIcon,
} from "lucide-react";
import { useGlobalSearch, MIN_QUERY_LENGTH, type SearchResults } from "@/lib/hooks/useGlobalSearch";
import { SearchGroup, ResultRow } from "@/components/layout/search/SearchResultRow";
import { getViewHistory, type ViewHistoryItem } from "@/lib/view-history";

type TabKey = "all" | "users" | "communities" | "ads" | "categories";

const TABS: { key: TabKey; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "users", label: "Люди" },
  { key: "communities", label: "Сообщества" },
  { key: "ads", label: "Объявления" },
  { key: "categories", label: "Направления" },
];

const KIND_ROUTE: Record<ViewHistoryItem["kind"], { to: string; icon: LucideIcon }> = {
  ad: { to: "/ads/$id", icon: Megaphone },
  profile: { to: "/user/$id", icon: UserIcon },
  review: { to: "/reviews/$id", icon: Clapperboard },
  community: { to: "/communities/$id", icon: Users2 },
};

const TAB_RESULT_KEY: Record<Exclude<TabKey, "all">, keyof SearchResults> = {
  users: "users",
  communities: "communities",
  ads: "ads",
  categories: "categories",
};

interface Props {
  open: boolean;
  onClose: () => void;
}

/** Full-screen mobile search takeover — VK-style tabs by content type plus a
 *  "recent" block backed by the shared view-history mechanism. Desktop keeps
 *  the GlobalSearch dropdown; this is lg:hidden-scoped only. */
export function MobileSearchOverlay({ open, onClose }: Props) {
  const [query, setQuery] = useState("");
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const q = query.trim();
  // Fixed perPage regardless of activeTab: the hook's effect depends on
  // [q, perPage], so a tab-dependent perPage would re-fetch on every tab
  // switch, violating "tabs filter already-fetched results, no new request
  // per tab" (spec §Решения #4). Fetch once at the largest size any tab
  // needs (20), then slice smaller per-group counts locally for the "Все"
  // tab display below.
  const { results, loading } = useGlobalSearch(q, { perPage: 20 });

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = prev; };
  }, [open]);

  const close = () => {
    onClose();
    setQuery("");
    setActiveTab("all");
  };

  const hasAny =
    results.users.length > 0 || results.communities.length > 0 || results.ads.length > 0 || results.categories.length > 0;
  const activeHasAny = activeTab === "all" ? hasAny : results[TAB_RESULT_KEY[activeTab]].length > 0;
  const recentItems = q.length === 0 ? getViewHistory() : [];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 8 }}
          transition={{ duration: 0.2 }}
          className="fixed inset-0 z-50 flex flex-col lg:hidden"
          style={{ height: "100dvh", background: "var(--background)" }}
        >
          <div
            className="flex shrink-0 items-center gap-2 px-4"
            style={{ paddingTop: "calc(var(--safe-top) + 8px)", paddingBottom: 8, borderBottom: "1px solid var(--border)" }}
          >
            <div className="relative min-w-0 flex-1">
              <SearchIcon
                size={16}
                className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2"
                style={{ color: "var(--foreground-50)" }}
              />
              <input
                type="search"
                autoFocus
                placeholder="Поиск по сайту"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                className="w-full text-[14px] outline-none transition-colors"
                style={{
                  background: "var(--background-elevated)",
                  color: "var(--foreground)",
                  border: "1px solid var(--border)",
                  borderRadius: "var(--r-input)",
                  height: 40,
                  padding: "0 12px 0 36px",
                }}
              />
            </div>
            <button
              type="button"
              onClick={close}
              className="shrink-0 text-[14px] font-medium"
              style={{ color: "var(--accent)" }}
            >
              Отмена
            </button>
          </div>

          <div
            className="flex shrink-0 gap-[6px] overflow-x-auto px-4 py-[10px]"
            style={{ borderBottom: "1px solid var(--border)" }}
          >
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => setActiveTab(t.key)}
                className="shrink-0 whitespace-nowrap text-[13px] font-medium transition-colors"
                style={{
                  background: activeTab === t.key ? "var(--accent-soft)" : "var(--background-elevated)",
                  color: activeTab === t.key ? "var(--accent)" : "var(--foreground-70)",
                  border: `1px solid ${activeTab === t.key ? "var(--border-accent)" : "var(--border)"}`,
                  borderRadius: "var(--r-tag)",
                  padding: "0 14px",
                  height: 32,
                }}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="flex-1 overflow-y-auto">
            {q.length === 0 ? (
              recentItems.length > 0 && (
                <SearchGroup label="Недавние" icon={Clock}>
                  {recentItems.map((item) => {
                    const { to, icon } = KIND_ROUTE[item.kind];
                    return (
                      <ResultRow
                        key={`${item.kind}-${item.id}`}
                        to={to}
                        params={{ id: item.id }}
                        avatar={item.thumb}
                        fallbackIcon={icon}
                        title={item.title}
                        onNavigate={close}
                      />
                    );
                  })}
                </SearchGroup>
              )
            ) : q.length < MIN_QUERY_LENGTH ? null : !activeHasAny ? (
              <div className="px-[14px] py-[14px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
                {loading ? "Ищем…" : "Ничего не найдено"}
              </div>
            ) : activeTab === "all" ? (
              // "Все" mirrors desktop's per-group limits (4/4/5/5) by slicing
              // the already-fetched (up to 20 each) arrays for display only —
              // no extra fetch, see the useGlobalSearch call above.
              <>
                {results.categories.length > 0 && (
                  <SearchGroup label="Направления" icon={Compass}>
                    {results.categories.slice(0, 5).map((c) => (
                      <ResultRow key={c.id} to="/categories/$id" params={{ id: c.id }} fallbackIcon={Compass} title={c.name} onNavigate={close} />
                    ))}
                  </SearchGroup>
                )}
                {results.users.length > 0 && (
                  <SearchGroup label="Люди" icon={UserIcon}>
                    {results.users.slice(0, 4).map((u) => (
                      <ResultRow key={u.id} to="/user/$id" params={{ id: u.slug ?? u.id }} avatar={u.avatar} fallbackIcon={UserIcon} title={u.name} subtitle={u.city} onNavigate={close} />
                    ))}
                  </SearchGroup>
                )}
                {results.communities.length > 0 && (
                  <SearchGroup label="Сообщества" icon={Users2}>
                    {results.communities.slice(0, 4).map((c) => (
                      <ResultRow key={c.id} to="/communities/$id" params={{ id: c.id }} avatar={c.avatarImage} fallbackIcon={Users2} title={c.name} subtitle={`${c.members} участников`} onNavigate={close} />
                    ))}
                  </SearchGroup>
                )}
                {results.ads.length > 0 && (
                  <SearchGroup label="Объявления" icon={Megaphone}>
                    {results.ads.slice(0, 5).map((ad) => (
                      <ResultRow key={ad.id} to="/ads/$id" params={{ id: ad.id }} avatar={ad.image} fallbackIcon={Megaphone} title={ad.title} subtitle={`${ad.price.toLocaleString("ru-RU")} ₽`} onNavigate={close} />
                    ))}
                  </SearchGroup>
                )}
              </>
            ) : (
              <>
                {activeTab === "categories" && results.categories.map((c) => (
                  <ResultRow key={c.id} to="/categories/$id" params={{ id: c.id }} fallbackIcon={Compass} title={c.name} onNavigate={close} />
                ))}
                {activeTab === "users" && results.users.map((u) => (
                  <ResultRow key={u.id} to="/user/$id" params={{ id: u.slug ?? u.id }} avatar={u.avatar} fallbackIcon={UserIcon} title={u.name} subtitle={u.city} onNavigate={close} />
                ))}
                {activeTab === "communities" && results.communities.map((c) => (
                  <ResultRow key={c.id} to="/communities/$id" params={{ id: c.id }} avatar={c.avatarImage} fallbackIcon={Users2} title={c.name} subtitle={`${c.members} участников`} onNavigate={close} />
                ))}
                {activeTab === "ads" && results.ads.map((ad) => (
                  <ResultRow key={ad.id} to="/ads/$id" params={{ id: ad.id }} avatar={ad.image} fallbackIcon={Megaphone} title={ad.title} subtitle={`${ad.price.toLocaleString("ru-RU")} ₽`} onNavigate={close} />
                ))}
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
