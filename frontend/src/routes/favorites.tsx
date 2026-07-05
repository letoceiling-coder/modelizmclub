import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Heart } from "lucide-react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import { CatalogCard } from "@/components/ads/CatalogCard";
import { AdCardSkeleton } from "@/components/ads/AdCardSkeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { fetchFavoriteListings } from "@/lib/api/listings";
import type { Ad } from "@/lib/mock";

export const Route = createFileRoute("/favorites")({
  head: () => ({ meta: [{ title: "Избранное — МоДелизМ" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    await requireAuth(location);
  },
  component: FavoritesPage,
});

function FavoritesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchFavoriteListings()
      .then((list) => { if (alive) setFavorites(list); })
      .catch(() => { if (alive) setFavorites([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  return (
    <AppLayout rightColumn={false} footer>
      <div className="space-y-[16px] pb-[24px]">
        <header>
          <h1 className="font-display text-[22px] font-bold leading-tight" style={{ color: "var(--foreground)" }}>
            {t("pages.favorites.title")}
          </h1>
          <p className="mt-[1px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
            {t("pages.favorites.subtitle")}
          </p>
        </header>

        {loading ? (
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <AdCardSkeleton key={i} />
            ))}
          </div>
        ) : favorites.length === 0 ? (
          <EmptyState
            icon={Heart}
            title={t("pages.favorites.emptyTitle")}
            description={t("pages.favorites.emptyDesc")}
          >
            <Button onClick={() => navigate({ to: "/ads" })}>{t("pages.favorites.toCatalog")}</Button>
          </EmptyState>
        ) : (
          <div className="grid grid-cols-2 gap-[12px] sm:grid-cols-3 lg:grid-cols-4 2xl:grid-cols-5">
            {favorites.map((ad) => (
              <CatalogCard key={ad.id} ad={ad} />
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
