import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Heart } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { CatalogCard } from "@/components/ads/CatalogCard";
import { AdCardSkeleton } from "@/components/ads/AdCardSkeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import { fetchListings } from "@/lib/api/listings";
import { useStore } from "@/lib/store";
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
  const navigate = useNavigate();
  const favoriteAdIds = useStore((s) => s.favoriteAdIds);
  const [allAds, setAllAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchListings()
      .then((list) => { if (alive) setAllAds(list); })
      .catch(() => { if (alive) setAllAds([]); })
      .finally(() => { if (alive) setLoading(false); });
    return () => { alive = false; };
  }, []);

  const favorites = useMemo(
    () => allAds.filter((a) => favoriteAdIds.includes(a.id)),
    [allAds, favoriteAdIds],
  );

  return (
    <AppLayout rightColumn={false} footer>
      <div className="space-y-[16px] pb-[24px]">
        <header>
          <h1 className="font-display text-[22px] font-bold leading-tight" style={{ color: "var(--foreground)" }}>
            Избранное
          </h1>
          <p className="mt-[1px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
            Объявления, которые вы отметили сердечком
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
            title="В избранном пусто"
            description="Добавляйте объявления сердечком в каталоге — они появятся здесь."
          >
            <Button onClick={() => navigate({ to: "/ads" })}>В каталог</Button>
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
