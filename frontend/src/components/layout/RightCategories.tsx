import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import { ChevronDown, MessageCircle } from "lucide-react";
import * as Icons from "lucide-react";
import { useTranslation } from "@/lib/i18n";
import type { Category } from "@/lib/types";
import { fetchListingCategories } from "@/lib/api/catalog";

// Детерминированный «онлайн» по id категории — без бэка, но стабильно от рендера к рендеру.
function onlineFor(c: Category): number {
  const seed = String(c.id).split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  return 3 + (seed % 24);
}

function CategoryIcon({ name, className }: { name?: string; className?: string }) {
  const Icon =
    (name ? (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] : undefined) ??
    Icons.Hash;
  return <Icon className={className} />;
}

export function RightCategories() {
  const { t } = useTranslation();
  const [categories, setCategories] = useState<Category[]>([]);
  const [openId, setOpenId] = useState<string | null>(null);

  useEffect(() => {
    void fetchListingCategories().then(setCategories).catch(() => setCategories([]));
  }, []);

  return (
    <aside className="hidden min-w-0 xl:block">
      <div
        className="sticky top-4 z-20 max-h-[calc(100dvh-2rem)] overflow-hidden rounded-[14px] border"
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
            const id = String(c.id);
            const linkId = c.slug ?? id;
            const open = openId === id;
            const online = onlineFor(c);
            const subs = c.subcategories ?? [];
            return (
              <li key={id}>
                <div className="flex items-stretch">
                  <Link
                    to="/categories/$id"
                    params={{ id: linkId }}
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
                        {t("common.onlineCount", { n: online })}
                      </span>
                    </span>
                  </Link>
                  {subs.length > 0 && (
                    <button
                      onClick={() => setOpenId(open ? null : id)}
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

                {open && subs.length > 0 && (
                  <ul
                    className="mb-[4px] ml-[36px] mt-[2px] space-y-[1px] border-l pl-[10px]"
                    style={{ borderColor: "var(--border)" }}
                  >
                    {subs.map((s) => (
                      <li key={String(s.id)}>
                        <Link
                          to="/categories/$id/$subId"
                          params={{ id: linkId, subId: s.slug ?? String(s.id) }}
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
