import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { ChevronDown, ChevronRight, MessageCircle, PanelRightClose, PanelRightOpen } from "lucide-react";
import { usePostCategories } from "@/lib/hooks/useCategories";
import {
  onlineForCategory,
  onlineForSubcategory,
  membersForSubcategory,
  totalOnlineFromStats,
  useCategoryRoomStats,
} from "@/lib/hooks/useCategoryRoomStats";
import { CategoryIcon, IconBox } from "@/components/ui/Icon";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";

const COLLAPSE_KEY = "modelizm:rightrail:collapsed";

type Props = {
  /** When true, category links are wrapped in GuestGuardLink (feed page). */
  guestGuard?: boolean;
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

export function DirectionsRightRail({ guestGuard = false }: Props) {
  const { t } = useTranslation();
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });
  const categories = usePostCategories();
  const roomStats = useCategoryRoomStats();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const totalOnline = useMemo(
    () => totalOnlineFromStats(roomStats),
    [roomStats],
  );

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

  return (
    <aside className="hidden w-64 shrink-0 xl:block xl:min-h-0">
      {/*
        min-h-0: flex child must not grow past viewport — inner overflow-y-auto scrolls.
        Card is shrink-0 / natural height — no flex-1 list, so no empty void below categories.
      */}
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
                  {t("components.rightCategories.title")}
                </h3>
                <p className="mt-[2px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                  {t("components.rightCategories.subtitle")}
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-[2px]">
                <RailLink
                  to="/categories"
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
          </div>

          <ul className="p-[6px]">
            {categories.map((c) => {
              const open = openId === c.id;
              const online = onlineForCategory(roomStats, c.id);
              const hasSubs = c.subcategories.length > 0;
              return (
                <li key={c.id}>
                  <div className="flex items-stretch">
                    <RailLink
                      to={`/categories/${c.id}`}
                      guestGuard={guestGuard}
                      actionKey="feed.rail.category"
                      className={`group flex flex-1 items-center gap-[10px] py-[8px] pl-[10px] transition-colors hover:bg-[var(--background-surface)] ${hasSubs ? "rounded-l-[10px] pr-[4px]" : "rounded-[10px] pr-[10px]"}`}
                    >
                      <IconBox size="sm" variant="surface">
                        <CategoryIcon categoryId={c.id} name={c.icon} iconImageUrl={c.iconImageUrl} fill />
                      </IconBox>
                      <span className="min-w-0 flex-1">
                        <span
                          className="block truncate text-[13.5px] font-medium"
                          style={{ color: "var(--foreground)" }}
                        >
                          {c.name}
                        </span>
                        <span className="mt-[1px] flex items-center gap-[5px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
                          <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "#22c55e" }} />
                          {t("components.rightCategories.onlineCount", { count: online })}
                        </span>
                      </span>
                    </RailLink>
                    {hasSubs && (
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : c.id)}
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

                  {open && hasSubs && (
                    <ul
                      className="mb-[4px] ml-[36px] mt-[2px] space-y-[1px] border-l pl-[10px]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {c.subcategories.map((s) => (
                        <li key={s.id}>
                          <RailLink
                            to={`/categories/${c.id}/${s.id}`}
                            guestGuard={guestGuard}
                            actionKey="feed.rail.subcategory"
                            className="block rounded-[6px] px-[8px] py-[5px] text-[12.5px] transition-colors hover:bg-[var(--background-surface)]"
                            style={{ color: "var(--foreground-70)" }}
                          >
                            {s.name}
                          </RailLink>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>

          <div
            className="shrink-0 border-t px-[12px] py-[10px]"
            style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
          >
            <div
              className="mb-[8px] flex items-center justify-between gap-[8px] rounded-[8px] px-[10px] py-[8px] text-[11px]"
              style={{ background: "var(--background-elevated)", color: "var(--foreground-50)" }}
            >
              <span>{t("components.rightCategories.directionsCount", { count: categories.length })}</span>
              <span className="flex items-center gap-[5px]">
                <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "#22c55e" }} />
                {t("components.rightCategories.totalOnline", { count: totalOnline.toLocaleString("ru-RU") })}
              </span>
            </div>
            <RailLink
              to="/categories"
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
