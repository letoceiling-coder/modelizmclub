import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, MessageCircle, PanelRightClose, PanelRightOpen, Search } from "lucide-react";
import { usePostCategoriesState, useListingCategoriesState } from "@/lib/hooks/useCategories";
import {
  onlineForCategory,
  totalOnlineFromStats,
  useCategoryRoomStats,
} from "@/lib/hooks/useCategoryRoomStats";
import { CategoryIcon, IconBox } from "@/components/ui/Icon";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import type { Category, CategoryChild } from "@/lib/mock";
import { parseTaxonomyId, type RailVariant } from "@/lib/taxonomy";

const COLLAPSE_KEY = "modelizm:rightrail:collapsed";
/** v3: first paint is always А–Я; older keys stored «popular» as an implicit default. */
const SORT_KEY = "modelizm:rightrail:sort:v3";

type SortMode = "popular" | "alpha";

type Props = {
  /** When true, category links are wrapped in GuestGuardLink (feed page). */
  guestGuard?: boolean;
  variant?: RailVariant;
};

type RailNode = {
  id: string;
  name: string;
  usageCount?: number;
  children: RailNode[];
};

function RailLink({
  to,
  guestGuard,
  actionKey,
  className,
  style,
  children,
}: {
  to: string;
  guestGuard?: boolean;
  actionKey?: string;
  className?: string;
  style?: React.CSSProperties;
  children: React.ReactNode;
}) {
  if (guestGuard && actionKey) {
    return (
      <GuestGuardLink actionKey={actionKey} to={to} className={className} style={style}>
        {children}
      </GuestGuardLink>
    );
  }
  return (
    <Link to={to} className={className} style={style}>
      {children}
    </Link>
  );
}

function sortNodes(nodes: RailNode[], sort: SortMode): RailNode[] {
  const copy = nodes.map((n) => ({ ...n, children: sortNodes(n.children, sort) }));
  copy.sort((a, b) => {
    if (sort === "alpha") return a.name.localeCompare(b.name, "ru");
    const byUsage = (b.usageCount ?? 0) - (a.usageCount ?? 0);
    return byUsage !== 0 ? byUsage : a.name.localeCompare(b.name, "ru");
  });
  return copy;
}

function toRailNodes(categories: Category[]): RailNode[] {
  const mapChild = (c: CategoryChild): RailNode => ({
    id: c.id,
    name: c.name,
    usageCount: c.usageCount,
    children: (c.children ?? []).map(mapChild),
  });
  return categories.map((c) => ({
    id: c.id,
    name: c.name,
    usageCount: c.usageCount,
    children: c.subcategories.map(mapChild),
  }));
}

function filterNodes(nodes: RailNode[], q: string): RailNode[] {
  if (!q) return nodes;
  return nodes.flatMap((node) => {
    const childMatches = filterNodes(node.children, q);
    if (node.name.toLowerCase().includes(q)) {
      return [node];
    }
    if (childMatches.length > 0) {
      return [{ ...node, children: childMatches }];
    }
    return [];
  });
}

function hrefFor(variant: RailVariant, id: string): string {
  if (variant === "ads") return `/ads?taxonomy_id=${id}`;
  if (variant === "communities") return `/communities?taxonomy_id=${id}`;
  if (variant === "channels") return `/channels?taxonomy_id=${id}`;
  return `/feed?taxonomy_id=${id}`;
}

/** Category chat: level-1 opens the room list, deeper levels open the room. */
function chatHrefFor(id: string, ancestors: string[]): string {
  if (ancestors.length === 0) return `/categories/${id}`;
  return `/categories/${ancestors[0]}/${id}`;
}

function allHref(variant: RailVariant): string {
  if (variant === "ads") return "/ads";
  if (variant === "communities") return "/communities";
  if (variant === "channels") return "/channels";
  return "/feed";
}

export function DirectionsRightRail({ guestGuard = false, variant = "feed" }: Props) {
  const { t } = useTranslation();
  const location = useLocation();
  const [openIds, setOpenIds] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortMode>(() => {
    if (typeof window === "undefined") return "alpha";
    return window.localStorage.getItem(SORT_KEY) === "popular" ? "popular" : "alpha";
  });
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });
  const { categories: postCategories, loading: postLoading } = usePostCategoriesState();
  const { categories: listingCategories, loading: listingLoading } = useListingCategoriesState();
  const categories = variant === "ads" ? listingCategories : postCategories;
  const categoriesLoading = variant === "ads" ? listingLoading : postLoading;
  const roomStats = useCategoryRoomStats();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(SORT_KEY, sort);
  }, [sort]);

  const activeTaxonomyId = useMemo(() => {
    const params = new URLSearchParams(location.searchStr.replace(/^\?/, ""));
    return parseTaxonomyId(params.get("taxonomy_id") ?? undefined);
  }, [location.searchStr]);

  const totalOnline = useMemo(
    () => totalOnlineFromStats(roomStats),
    [roomStats],
  );

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return sortNodes(filterNodes(toRailNodes(categories), q), sort);
  }, [categories, query, sort]);

  useEffect(() => {
    if (!query.trim()) return;
    const next: Record<string, boolean> = {};
    const walk = (nodes: RailNode[]) => {
      for (const n of nodes) {
        if (n.children.length > 0) {
          next[n.id] = true;
          walk(n.children);
        }
      }
    };
    walk(visible);
    setOpenIds((prev) => ({ ...prev, ...next }));
  }, [query, visible]);

  const catalog = variant !== "feed";
  const title = catalog ? t("components.rightCategories.titleCatalog") : t("components.rightCategories.title");
  const subtitle = catalog
    ? t(`components.rightCategories.subtitle${variant.charAt(0).toUpperCase()}${variant.slice(1)}`)
    : t("components.rightCategories.subtitle");

  if (collapsed) {
    return (
      <aside className="hidden w-11 shrink-0 justify-center pt-4 xl:flex">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label={t("components.rightCategories.expandPanel")}
          className="grid h-9 w-9 place-items-center rounded-[10px] border transition-colors hover:bg-[var(--background-surface)]"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)", color: "var(--foreground-70)" }}
        >
          <PanelRightOpen className="h-[18px] w-[18px]" />
        </button>
      </aside>
    );
  }

  const renderNodes = (nodes: RailNode[], ancestors: string[], depth: number) => (
    <ul className={depth === 0 ? "p-[6px]" : "mb-[4px] ml-[36px] mt-[2px] space-y-[1px] border-l pl-[10px]"} style={depth === 0 ? undefined : { borderColor: "var(--border)" }}>
      {nodes.map((node) => {
        const open = Boolean(openIds[node.id]);
        const hasChildren = node.children.length > 0;
        const href = hrefFor(variant, node.id);
        const active = activeTaxonomyId === Number(node.id);
        const pad = depth === 0 ? "py-[8px] pl-[10px]" : "px-[8px] py-[5px]";
        const toggle = () => setOpenIds((p) => ({ ...p, [node.id]: !p[node.id] }));
        const label = (
          <>
            {depth === 0 && (
              <IconBox size="sm" variant="surface">
                <CategoryIcon categoryId={node.id} name={categories.find((c) => c.id === node.id)?.icon} iconImageUrl={categories.find((c) => c.id === node.id)?.iconImageUrl} fill />
              </IconBox>
            )}
            <span className="min-w-0 flex-1 text-left">
              <span
                className={`block truncate ${depth === 0 ? "text-[13.5px] font-medium" : "text-[12.5px]"}`}
                style={{ color: depth === 0 ? "var(--foreground)" : "var(--foreground-70)" }}
              >
                {node.name}
              </span>
              {depth === 0 && !catalog && (
                <span className="mt-[1px] flex items-center gap-[5px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
                  <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "#22c55e" }} />
                  {t("components.rightCategories.onlineCount", { count: onlineForCategory(roomStats, node.id) })}
                </span>
              )}
            </span>
          </>
        );
        const rowClass = `group flex flex-1 items-center gap-[10px] ${pad} transition-colors hover:bg-[var(--background-surface)] ${hasChildren ? "rounded-l-[10px] pr-[4px]" : "rounded-[10px] pr-[10px]"}`;
        const rowStyle = active ? { background: "var(--accent-soft)" } : undefined;

        return (
          <li key={node.id}>
            <div className="flex items-stretch">
              {hasChildren ? (
                // A branch expands on click; the filter lives on its leaves and
                // on the chat icon next to it.
                <button type="button" onClick={toggle} aria-expanded={open} className={rowClass} style={rowStyle}>
                  {label}
                </button>
              ) : (
                <RailLink
                  to={href}
                  guestGuard={guestGuard}
                  actionKey={depth === 0 ? "feed.rail.category" : "feed.rail.subcategory"}
                  className={rowClass}
                  style={rowStyle}
                >
                  {label}
                </RailLink>
              )}
              {!catalog && (
                <RailLink
                  to={chatHrefFor(node.id, ancestors)}
                  guestGuard={guestGuard}
                  actionKey={depth === 0 ? "feed.rail.category" : "feed.rail.subcategory"}
                  className="grid w-[26px] shrink-0 place-items-center transition-colors hover:bg-[var(--background-surface)]"
                  style={{ color: "var(--foreground-50)" }}
                >
                  <MessageCircle className="h-[13px] w-[13px]" />
                </RailLink>
              )}
              {hasChildren && (
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={
                    open
                      ? t("components.rightCategories.collapseSubcategories")
                      : t("components.rightCategories.expandSubcategories")
                  }
                  aria-expanded={open}
                  className="grid w-[28px] shrink-0 place-items-center rounded-r-[10px] transition-colors hover:bg-[var(--background-surface)]"
                >
                  <ChevronDown
                    className={`h-[14px] w-[14px] transition-transform ${open ? "rotate-180" : ""}`}
                    style={{ color: "var(--foreground-50)" }}
                  />
                </button>
              )}
            </div>
            {open && hasChildren && (
              <>
                <RailLink
                  to={href}
                  guestGuard={guestGuard}
                  actionKey={depth === 0 ? "feed.rail.category" : "feed.rail.subcategory"}
                  className="mb-[2px] ml-[36px] mt-[2px] block border-l pl-[10px] text-[12px]"
                  style={{ borderColor: "var(--border)", color: active ? "var(--accent)" : "var(--foreground-50)" }}
                >
                  {t("components.rightCategories.allInCategory")}
                </RailLink>
                {renderNodes(node.children, [...ancestors, node.id], depth + 1)}
              </>
            )}
          </li>
        );
      })}
    </ul>
  );

  return (
    <aside className="hidden w-64 shrink-0 xl:block xl:min-h-0">
      <div className="flex h-full flex-col overflow-y-auto pb-4" style={{ scrollbarWidth: "thin" }}>
        <div
          className="shrink-0 overflow-hidden rounded-[var(--r-card)] border"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
        >
          <div className="border-b px-[16px] py-[14px]" style={{ borderColor: "var(--border)" }}>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3
                  className="flex items-center gap-[8px] text-[14px] font-semibold"
                  style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
                >
                  <MessageCircle className="h-[16px] w-[16px] shrink-0" style={{ color: "var(--accent)" }} />
                  {title}
                </h3>
                <p className="mt-[2px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                  {subtitle}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-[2px]">
                <RailLink
                  to={allHref(variant)}
                  guestGuard={guestGuard}
                  actionKey="feed.rail.all_categories"
                  className="flex items-center gap-[2px] px-[4px] py-[2px] text-[12px] font-medium transition-colors hover:opacity-80"
                  style={{ color: "var(--accent)" }}
                >
                  {t("components.rightCategories.allShort")}
                  <ChevronRight className="h-[13px] w-[13px]" />
                </RailLink>
                <button
                  type="button"
                  onClick={() => setCollapsed(true)}
                  aria-label={t("components.rightCategories.collapsePanel")}
                  className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] transition-colors hover:bg-[var(--background-surface)]"
                  style={{ color: "var(--foreground-50)" }}
                >
                  <PanelRightClose className="h-[16px] w-[16px]" />
                </button>
              </div>
            </div>

            <label className="relative mt-[10px] block">
              <Search className="pointer-events-none absolute left-[10px] top-1/2 h-[14px] w-[14px] -translate-y-1/2" style={{ color: "var(--foreground-50)" }} />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("components.rightCategories.searchPlaceholder")}
                className="h-[34px] w-full rounded-[8px] border bg-transparent pl-[30px] pr-[10px] text-[12.5px] outline-none"
                style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
              />
            </label>
            <div className="mt-[8px] flex gap-[6px]">
              <button
                type="button"
                onClick={() => setSort("popular")}
                className="rounded-full px-[10px] py-[4px] text-[11px] font-medium"
                style={{
                  background: sort === "popular" ? "var(--accent-soft)" : "transparent",
                  color: sort === "popular" ? "var(--accent)" : "var(--foreground-50)",
                  border: `1px solid ${sort === "popular" ? "var(--border-accent)" : "var(--border)"}`,
                }}
              >
                {t("components.rightCategories.sortPopular")}
              </button>
              <button
                type="button"
                onClick={() => setSort("alpha")}
                className="rounded-full px-[10px] py-[4px] text-[11px] font-medium"
                style={{
                  background: sort === "alpha" ? "var(--accent-soft)" : "transparent",
                  color: sort === "alpha" ? "var(--accent)" : "var(--foreground-50)",
                  border: `1px solid ${sort === "alpha" ? "var(--border-accent)" : "var(--border)"}`,
                }}
              >
                {t("components.rightCategories.sortAlpha")}
              </button>
            </div>
          </div>

          {categoriesLoading ? (
            <div className="space-y-[6px] p-[12px]" aria-busy="true" aria-live="polite">
              {Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[36px] animate-pulse rounded-[10px]"
                  style={{ background: "var(--background-surface)" }}
                />
              ))}
            </div>
          ) : visible.length === 0 ? (
            <p className="px-[16px] py-[14px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {t("components.rightCategories.emptySearch")}
            </p>
          ) : (
            renderNodes(visible, [], 0)
          )}

          <div
            className="shrink-0 border-t px-[12px] py-[10px]"
            style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
          >
            <div
              className="mb-[8px] flex items-center justify-between gap-[8px] rounded-[8px] px-[10px] py-[8px] text-[11px]"
              style={{ background: "var(--background-elevated)", color: "var(--foreground-50)" }}
            >
              <span>{t("components.rightCategories.directionsCount", { count: categories.length })}</span>
              {!catalog && (
                <span className="flex items-center gap-[5px]">
                  <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "#22c55e" }} />
                  {t("components.rightCategories.totalOnline", { count: totalOnline.toLocaleString("ru-RU") })}
                </span>
              )}
            </div>
            <RailLink
              to={allHref(variant)}
              guestGuard={guestGuard}
              actionKey="feed.rail.all_categories"
              className="flex w-full items-center justify-center rounded-[8px] px-[10px] py-[8px] text-[12px] font-semibold transition-colors hover:bg-[var(--background-elevated)]"
              style={{ color: "var(--accent)" }}
            >
              {t("components.rightCategories.allDirections")}
            </RailLink>
          </div>
        </div>
      </div>
    </aside>
  );
}
