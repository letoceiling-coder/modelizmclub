import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState, useCallback } from "react";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { CatalogCard } from "@/components/ads/CatalogCard";
import { AdCardSkeleton } from "@/components/ads/AdCardSkeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { fetchFavoriteListings } from "@/lib/api/listings";
import { actions, useStore } from "@/lib/store";
import type { Ad } from "@/lib/mock";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: i18n.t("pages.favorites.metaTitle") }] }),
  component: FavoritesPage,
});

function FavoritesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  /*
   * Четыре состояния списка: скелетон, ошибка с «Повторить», пусто, данные.
   *
   * Раньше `.catch` просто чистил список, и неудачная загрузка выглядела как
   * «в избранном пусто» — то есть как ответ сервера, которого не было. Тот же
   * дефект чинили в сообществах 05.09, см. комментарий в communities.index.
   */
  const [loadFailed, setLoadFailed] = useState(false);
  const favoriteAdIds = useStore((s) => s.favoriteAdIds);

  const load = useCallback(() => {
    let alive = true;
    setLoading(true);
    setLoadFailed(false);
    fetchFavoriteListings()
      .then((list) => {
        if (!alive) return;
        setFavorites(list);
        // Keep heart state in sync with the server list so unfavorite updates UI.
        actions.setFavoriteAdIds(list.map((ad) => ad.id));
      })
      .catch(() => {
        if (!alive) return;
        setFavorites([]);
        setLoadFailed(true);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  useEffect(() => load(), [load]);

  const visibleFavorites = useMemo(
    () => favorites.filter((ad) => favoriteAdIds.includes(ad.id)),
    [favorites, favoriteAdIds],
  );

  return (
    <AppLayout rightColumn={false} footer>
      <div className="space-y-[16px] pb-[24px]">
        <header>
          <h1
            className="font-display text-[22px] font-bold leading-tight"
            style={{ color: "var(--foreground)" }}
          >
            {t("pages.favorites.title")}
          </h1>
          <p className="mt-[1px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
            {t("pages.favorites.subtitle")}
          </p>
        </header>

        {loading ? (
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:[grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
            {Array.from({ length: 8 }).map((_, i) => (
              <AdCardSkeleton key={i} />
            ))}
          </div>
        ) : loadFailed ? (
          <EmptyState
            icon={Heart}
            title={t("pages.favorites.loadFailedTitle")}
            description={t("pages.favorites.loadFailedDesc")}
            action={{ label: t("pages.shared.retry"), onClick: load }}
            variant="compact"
          />
        ) : visibleFavorites.length === 0 ? (
          <EmptyState
            icon={Heart}
            title={t("pages.favorites.emptyTitle")}
            description={t("pages.favorites.emptyDesc")}
          >
            <Button onClick={() => navigate({ to: "/ads" })}>
              {t("pages.favorites.toCatalog")}
            </Button>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:[grid-template-columns:repeat(auto-fill,minmax(190px,1fr))]">
            {visibleFavorites.map((ad) => (
              <CatalogCard key={ad.id} ad={ad} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
