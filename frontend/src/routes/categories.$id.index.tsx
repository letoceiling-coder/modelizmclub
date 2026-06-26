import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowLeft, ChevronRight, MessageCircle, Search, Tag, Users } from "lucide-react";
import * as Icons from "lucide-react";
import { useState, useMemo } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { categoryById, ads } from "@/lib/mock";
import type { Category } from "@/lib/mock";

export const Route = createFileRoute("/categories/$id/")({
  head: ({ params }) => {
    const c = categoryById(params.id);
    const title = c ? tStatic("categories.metaRooms", { name: c.name }) : tStatic("categories.metaCategoryFallback");
    return { meta: [{ title: `${title} — МоДелизМ Форум` }] };
  },
  component: CategoryRoomsPage,
});

function seedFrom(s: string): number {
  return s.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
}

function onlineFor(c: Category, subId: string): number {
  const seed = seedFrom(c.id + subId);
  const base = Math.max(2, Math.round((c.members / c.subcategories.length) * 0.012));
  return base + (seed % 11);
}

function membersOf(c: Category, subId: string): number {
  const seed = seedFrom(c.id + subId);
  return Math.max(8, Math.round(c.members / c.subcategories.length)) + (seed % 30);
}

const ROOM_PREVIEWS = [
  "Кто гонял на новой трассе в выходные?",
  "Поделитесь настройками — подвеска плывёт.",
  "Продаю комплект, отдам в хорошие руки.",
  "Сегодня собираемся в клубе в 18:00.",
  "Свежее видео обкатки выложил в чате.",
  "Подскажите по моторам — что брать?",
  "Сборка готова, делюсь фото.",
  "Кто будет на гонке в субботу?",
];

function CategoryRoomsPage() {
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const c = categoryById(id);
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
        <p className="text-sm" style={{ color: "var(--foreground-50)" }}>{t("categories.notFound")}</p>
      </AppLayout>
    );
  }

  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[c.icon] ??
    Icons.Hash;

  return (
    <AppLayout rightColumn={false}>
      <div className="space-y-[14px]">
        <Breadcrumbs items={[{ label: t("categories.breadcrumb"), to: "/categories" }, { label: c.name }]} />
        {/* Header */}
        <header
          className="rounded-[14px] border p-[16px]"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
        >
          <div className="flex items-center gap-[10px]">
            <Link
              to="/feed"
              aria-label={t("common.back")}
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
                {c.description} · {t("profile.membersCount", { n: c.members.toLocaleString("ru") })}
              </p>
            </div>
          </div>
        </header>

        {/* Search */}
        <div
          className="rounded-[14px] border px-[14px] py-[10px]"
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
              placeholder={t("categories.searchRoom")}
              className="min-w-0 flex-1 bg-transparent text-[14px] outline-none placeholder:text-[var(--foreground-50)]"
              style={{ color: "var(--foreground)" }}
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="grid h-[22px] w-[22px] place-items-center rounded-full transition-colors"
                style={{ background: "var(--background-elevated)", color: "var(--foreground-50)" }}
                aria-label={t("categories.clear")}
              >
                ×
              </button>
            )}
          </div>
        </div>

        {/* Rooms */}
        <section
          className="overflow-hidden rounded-[14px] border"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
        >
          <div
            className="flex items-center justify-between border-b px-[16px] py-[12px]"
            style={{ borderColor: "var(--border)" }}
          >
            <h2 className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
              {t("categories.roomsTitle")}
            </h2>
            <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {filteredSubs.length}
            </span>
          </div>

          <ul>
            {filteredSubs.map((s, i) => {
              const online = onlineFor(c, s.id);
              const members = membersOf(c, s.id);
              const adsCount = ads.filter((a) => a.category === c.name && a.subcategory === s.name).length;
              const preview = ROOM_PREVIEWS[(seedFrom(c.id + s.id) + i) % ROOM_PREVIEWS.length];
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
                          <MessageCircle className="h-[11px] w-[11px]" /> {t("categories.chatBadge")}
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
                {t("categories.emptySearch", { query })}
              </li>
            )}
          </ul>
        </section>

        <p className="px-[4px] text-[11.5px]" style={{ color: "var(--foreground-50)" }}>
          {t("categories.roomsHint")}
        </p>

      </div>
    </AppLayout>
  );
}
