import { useState, useEffect } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, MessageCircle, PanelRightClose, PanelRightOpen } from "lucide-react";

const COLLAPSE_KEY = "modelizm:rightrail:collapsed";
import * as Icons from "lucide-react";
import type { Category } from "@/lib/mock";
import { onlineFor } from "@/lib/category-online";
import { usePostCategories } from "@/lib/hooks/useCategories";

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ??
    Icons.Hash;
  return <Icon className={className} />;
}

export function RightCategories() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });
  const categories = usePostCategories();

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

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
    <aside className="hidden xl:block w-64 shrink-0">
      {/* h-full: parent <aside> is stretched to 100dvh by AppLayout's items-stretch.
           flex-col lets the header be fixed-height and the ul scroll freely. */}
      <div
        className="flex h-full flex-col overflow-hidden rounded-[var(--r-card)] border"
        style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
      >
        <div className="border-b px-[16px] py-[14px]" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between gap-2">
            <h3
              className="flex items-center gap-[8px] text-[14px] font-semibold"
              style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
            >
              <MessageCircle className="h-[16px] w-[16px]" style={{ color: "var(--accent)" }} />
              Найди своих
            </h3>
            <button
              type="button"
              onClick={() => setCollapsed(true)}
              aria-label="Свернуть панель"
              className="grid h-7 w-7 shrink-0 place-items-center rounded-[8px] transition-colors hover:bg-[var(--background-surface)]"
              style={{ color: "var(--foreground-50)" }}
            >
              <PanelRightClose className="h-[16px] w-[16px]" />
            </button>
          </div>
          <p className="mt-[2px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            Зайди в чат своего направления
          </p>
        </div>

        <ul className="flex-1 overflow-y-auto p-[6px]" style={{ scrollbarWidth: "thin" }}>
          {categories.map((c) => {
            const open = openId === c.id;
            const online = onlineFor(c);
            return (
              <li key={c.id}>
                <div className="flex items-stretch">
                  <Link
                    to="/categories/$id"
                    params={{ id: c.id }}
                    className="group flex flex-1 items-center gap-[10px] rounded-l-[10px] px-[10px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
                  >
                    <span
                      className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[8px]"
                      style={{ background: "var(--background-surface)", color: "var(--accent)" }}
                    >
                      <CategoryIcon name={c.icon} className="h-[14px] w-[14px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-[13.5px] font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {c.name}
                      </span>
                      <span className="mt-[1px] flex items-center gap-[5px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
                        <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "#22c55e" }} />
                        {online} онлайн
                      </span>
                    </span>
                  </Link>
                  {c.subcategories.length > 0 && (
                    <button
                      onClick={() => setOpenId(open ? null : c.id)}
                      aria-label={open ? "Свернуть подкатегории" : "Развернуть подкатегории"}
                      aria-expanded={open}
                      className="grid w-[28px] place-items-center rounded-r-[10px] transition-colors hover:bg-[var(--background-surface)]"
                    >
                      <ChevronDown
                        className={`h-[14px] w-[14px] transition-transform ${open ? "rotate-180" : ""}`}
                        style={{ color: "var(--foreground-50)" }}
                      />
                    </button>
                  )}
                </div>

                {open && c.subcategories.length > 0 && (
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
      </div>
    </aside>
  );
}
