import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, MessageCircle } from "lucide-react";
import * as Icons from "lucide-react";
import { categories } from "@/lib/mock";
import type { Category } from "@/lib/mock";
import { useTranslation } from "@/lib/i18n";

// Детерминированный «онлайн» по id категории — без бэка, но стабильно от рендера к рендеру.
function onlineFor(c: Category): number {
  const seed = c.id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const base = Math.max(3, Math.round(c.members * 0.012));
  return base + (seed % 17);
}

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ??
    Icons.Hash;
  return <Icon className={className} />;
}

export function RightCategories() {
  const [openId, setOpenId] = useState<string | null>(null);
  const { t } = useTranslation();

  return (
    <div className="hidden w-[18rem] shrink-0 xl:block">
      <aside className="layout-sidebar-right">
      <div
        className="overflow-hidden rounded-[14px] border"
        style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
      >
        <div className="border-b px-[16px] py-[14px]" style={{ borderColor: "var(--border)" }}>
          <h3
            className="flex items-center gap-[8px] text-[14px] font-semibold"
            style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
          >
            <MessageCircle className="h-[16px] w-[16px]" style={{ color: "var(--accent)" }} />
            {t("rightPanel.title")}
          </h3>
          <p className="mt-[2px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            {t("rightPanel.subtitle")}
          </p>
        </div>

        <ul className="max-h-[calc(100dvh-12rem)] overflow-y-auto p-[6px]">
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
                        {online} {t("common.online")}
                      </span>
                    </span>
                  </Link>
                  {c.subcategories.length > 0 && (
                    <button
                      onClick={() => setOpenId(open ? null : c.id)}
                      aria-label={open ? t("rightPanel.collapseSubs") : t("rightPanel.expandSubs")}
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
    </div>
  );
}
