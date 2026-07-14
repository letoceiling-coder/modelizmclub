import { useEffect, useMemo, useState } from "react";
import { Link } from "@tanstack/react-router";
import { PanelRightClose, PanelRightOpen, ChevronRight, ChevronDown } from "lucide-react";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { onlineFor } from "@/lib/category-online";
import { CategoryIcon } from "@/components/ui/Icon";

const COLLAPSE_KEY = "modelizm:feedrail:collapsed";

function RailCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      // shrink-0: the card lives inside the rail's flex-col scroll container.
      // Its own overflow-hidden (for the rounded corners) zeroes its flex
      // auto-min-height, so without this the flex algorithm shrank the card to
      // the viewport height and clipped the category list instead of letting
      // the scroll container scroll. Keeping the card at its natural height
      // makes the outer overflow-y-auto do the scrolling.
      className="shrink-0 overflow-hidden rounded-[var(--r-card)] border"
      style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, to, onCollapse }: { title: string; to: string; onCollapse?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b px-[14px] py-[11px]" style={{ borderColor: "var(--border)" }}>
      <h3 className="text-[13.5px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
        {title}
      </h3>
      <div className="flex items-center gap-[2px]">
        <Link
          to={to}
          className="flex items-center gap-[2px] text-[12px] transition-colors hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          Все <ChevronRight className="h-[13px] w-[13px]" />
        </Link>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Свернуть панель"
            className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground-50)" }}
          >
            <PanelRightClose className="h-[15px] w-[15px]" />
          </button>
        )}
      </div>
    </div>
  );
}

export function FeedRightRail() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const categories = usePostCategories();
  // Display-only sort — the landing's "Направления" section reads the same
  // usePostCategories()/fetchPostCategories() source in its original
  // (backend/category-priority) order, and other code may rely on that
  // order too (e.g. categoryIdByName's index-based id fallback in demo
  // mode). Sorting a copy here, only for what this list renders, keeps
  // that shared order and cache untouched.
  const sortedCategories = useMemo(
    () => [...categories].sort((a, b) => a.name.localeCompare(b.name, "ru")),
    [categories],
  );

  if (collapsed) {
    return (
      <aside className="hidden xl:flex w-11 shrink-0 justify-center pt-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Развернуть панель"
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
      {/* min-h-0 on the aside: as a flex child of AppLayout's items-stretch
          row its default min-height:auto let it grow to the full category
          list height, so the shell's overflow-hidden clipped the overflow
          instead of the inner overflow-y-auto scrolling (unlike <main>,
          whose own overflow-y-auto implicitly zeroes its min-height). With
          min-h-0 the aside stays at its stretched height and the inner list
          scrolls. */}
      <div className="flex h-full flex-col gap-[12px] overflow-y-auto pb-4">

        {/* Card 1 — Направления. Shows every direction (not a top-N
            subset) — this list must match the landing's "Направления"
            section 1:1, both by name/order and by data source
            (usePostCategories -> fetchPostCategories, same module-level
            cache the landing now reads from too). */}
        <RailCard>
          <CardHeader title="Направления" to="/categories" onCollapse={() => setCollapsed(true)} />
          <ul className="p-[6px]">
            {sortedCategories.map((c) => {
              const online = onlineFor(c);
              const open = openId === c.id;
              const hasSubs = c.subcategories.length > 0;
              return (
                <li key={c.id}>
                  <div className="flex items-stretch">
                    <Link
                      to="/categories/$id"
                      params={{ id: c.id }}
                      className={`flex flex-1 items-center gap-[10px] py-[8px] pl-[10px] transition-colors hover:bg-[var(--background-surface)] ${hasSubs ? "rounded-l-[10px] pr-[4px]" : "rounded-[10px] pr-[10px]"}`}
                    >
                      <span
                        className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[8px]"
                        style={{ background: "var(--background-surface)", color: "var(--accent)" }}
                      >
                        <CategoryIcon categoryId={c.id} name={c.icon} className="h-[14px] w-[14px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium" style={{ color: "var(--foreground)" }}>
                          {c.name}
                        </span>
                        <span className="mt-[1px] flex items-center gap-[5px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
                          <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "#22c55e" }} />
                          {online} онлайн
                        </span>
                      </span>
                    </Link>
                    {hasSubs && (
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : c.id)}
                        aria-label={open ? "Свернуть подкатегории" : "Развернуть подкатегории"}
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
                          <Link
                            to="/categories/$id/$subId"
                            params={{ id: c.id, subId: s.id }}
                            className="block rounded-[6px] px-[8px] py-[5px] text-[12.5px] transition-colors hover:bg-[var(--background-surface)]"
                            style={{ color: "var(--foreground-70)" }}
                          >
                            {s.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </RailCard>

      </div>
    </aside>
  );
}
