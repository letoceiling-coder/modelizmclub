import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, MessageCircle, Search, Tag, Users } from "lucide-react";
import * as Icons from "lucide-react";
import { useState, useMemo } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import type { Category } from "@/lib/mock";
import { usePostCategories } from "@/lib/hooks/useCategories";
import {
  membersForSubcategory,
  onlineForSubcategory,
  useCategoryRoomStats,
} from "@/lib/hooks/useCategoryRoomStats";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/categories/$id/")({
  head: () => ({ meta: [{ title: i18n.t("pages.categoryDetail.metaTitle") }] }),
  component: CategoryRoomsPage,
});

function seedFrom(s: string): number {
  return s.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
}

const ROOM_PREVIEW_KEYS = [
  "roomPreview0",
  "roomPreview1",
  "roomPreview2",
  "roomPreview3",
  "roomPreview4",
  "roomPreview5",
  "roomPreview6",
  "roomPreview7",
] as const;

function CategoryRoomsPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const categories = usePostCategories();
  const c = categories.find((x) => x.id === id);
  const roomStats = useCategoryRoomStats(id);
  const [query, setQuery] = useState("");

  const filteredSubs = useMemo(() => {
    if (!c) return [];
    const q = query.trim().toLowerCase();
    if (!q) return c.subcategories;
    return c.subcategories.filter((s) => s.name.toLowerCase().includes(q));
  }, [c, query]);

  if (!c) {
    return (
      <AppLayout rightColumn={false}>
        <p className="text-sm" style={{ color: "var(--foreground-50)" }}>
          {categories.length === 0 ? t("pages.categoryDetail.loading") : t("pages.categoryDetail.notFound")}
        </p>
      </AppLayout>
    );
  }

  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[c.icon] ??
    Icons.Hash;

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-[14px]">
        <Breadcrumbs items={[{ label: t("pages.categoryDetail.breadcrumbs"), to: "/categories" }, { label: c.name }]} />
        <header
          className="rounded-[var(--r-card)] border p-[16px]"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-[10px]">
            <Link
              to="/feed"
              aria-label={t("pages.categoryDetail.backAria")}
              className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-[10px] transition-colors hover:bg-[var(--background-surface)]"
            >
              <ArrowLeft className="h-[16px] w-[16px]" style={{ color: "var(--foreground-70)" }} />
            </Link>
            <span
              className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px]"
              style={{ background: "var(--background-surface)", color: "var(--accent)" }}
            >
              <Icon className="h-[20px] w-[20px]" />
            </span>
            <div className="min-w-0 flex-1">
              <h1
                className="truncate text-[18px] font-semibold"
                style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
              >
                {c.name}
              </h1>
              <p className="truncate text-[12.5px]" style={{ color: "var(--foreground-50)" }}>
                {c.description} · {t("pages.shared.members", { count: c.members })}
              </p>
            </div>
          </div>
        </header>

        <div
          className="rounded-[var(--r-card)] border px-[14px] py-[10px]"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
        >
          <div
            className="flex items-center gap-[10px] rounded-[10px] border px-[12px] py-[8px]"
            style={{ background: "var(--background-surface)", borderColor: "var(--border)" }}
          >
            <Search className="h-[16px] w-[16px] shrink-0" style={{ color: "var(--foreground-50)" }} />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("pages.categoryDetail.searchPlaceholder")}
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--foreground-50)]"
              style={{ color: "var(--foreground)" }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="grid h-[22px] w-[22px] place-items-center rounded-full transition-colors"
                style={{ background: "var(--background-elevated)", color: "var(--foreground-50)" }}
                aria-label={t("pages.categoryDetail.clearAria")}
              >
                ×
              </button>
            )}
          </div>
        </div>

        <section
          className="overflow-hidden rounded-[var(--r-card)] border"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
        >
          <div
            className="flex items-center justify-between border-b px-[16px] py-[12px]"
            style={{ borderColor: "var(--border)" }}
          >
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
              {t("pages.categoryDetail.roomsHeading")}
            </h2>
            <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {filteredSubs.length}
            </span>
          </div>

          <ul>
            {filteredSubs.map((s, i) => {
              const online = onlineForSubcategory(roomStats, s.id);
              const members = membersForSubcategory(roomStats, s.id);
              const adsCount = 0;
              const previewKey = ROOM_PREVIEW_KEYS[(seedFrom(c.id + s.id) + i) % ROOM_PREVIEW_KEYS.length];
              const preview = t(`pages.categoryDetail.${previewKey}`);
              return (
                <li key={s.id} className="border-t first:border-t-0" style={{ borderColor: "var(--border)" }}>
                  <Link
                    to="/categories/$id/$subId"
                    params={{ id: c.id, subId: s.id }}
                    className="flex items-center gap-[12px] px-[16px] py-[12px] transition-colors hover:bg-[var(--background-surface)]"
                  >
                    <span
                      className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-[12px] text-[14px] font-semibold"
                      style={{ background: "var(--background-surface)", color: "var(--accent)" }}
                    >
                      #
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-[8px]">
                        <span
                          className="truncate text-[14.5px] font-semibold"
                          style={{ color: "var(--foreground)" }}
                        >
                          {s.name}
                        </span>
                        <span
                          className="inline-flex shrink-0 items-center gap-[4px] text-[11px]"
                          style={{ color: "var(--foreground-50)" }}
                        >
                          <span
                            className="inline-block h-[6px] w-[6px] rounded-full"
                            style={{ background: "#22c55e" }}
                          />
                          {online}
                        </span>
                      </div>
                      <p
                        className="mt-[2px] truncate text-[12.5px]"
                        style={{ color: "var(--foreground-50)" }}
                      >
                        {preview}
                      </p>
                      <div
                        className="mt-[4px] flex items-center gap-[10px] text-[11px]"
                        style={{ color: "var(--foreground-50)" }}
                      >
                        <span className="inline-flex items-center gap-[3px]">
                          <Users className="h-[11px] w-[11px]" /> {members}
                        </span>
                        <span className="inline-flex items-center gap-[3px]">
                          <Tag className="h-[11px] w-[11px]" /> {adsCount}
                        </span>
                        <span className="inline-flex items-center gap-[3px]">
                          <MessageCircle className="h-[11px] w-[11px]" /> {t("pages.categoryDetail.chatLabel")}
                        </span>
                      </div>
                    </div>
                    <ChevronRight
                      className="h-[16px] w-[16px] shrink-0"
                      style={{ color: "var(--foreground-50)" }}
                    />
                  </Link>
                </li>
              );
            })}
            {filteredSubs.length === 0 && (
              <li className="px-[16px] py-[24px] text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>
                {t("pages.categoryDetail.noResults", { query })}
              </li>
            )}
          </ul>
        </section>

        <p className="px-[4px] text-[11.5px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.categoryDetail.footerNote")}
        </p>

      </div>
    </AppLayout>
  );
}
