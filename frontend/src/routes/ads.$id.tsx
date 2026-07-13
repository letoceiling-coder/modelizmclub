import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Ad } from "@/lib/mock";
import { fetchListing, fetchListings, addFavoriteListing, removeFavoriteListing, revealSellerPhone } from "@/lib/api/listings";
import { AdGallery } from "@/components/ads/AdGallery";
import { SellerCard } from "@/components/ads/SellerCard";
import { SimilarAds, SIMILAR_ADS_SLOTS } from "@/components/ads/SimilarAds";
import { AdActionPanel } from "@/components/ads/AdActionPanel";
import { AskSellerWidget } from "@/components/ads/AskSellerWidget";
import { MobileStickyActionBar } from "@/components/ads/MobileStickyActionBar";
import { DeliveryChoiceSheet } from "@/components/ads/DeliveryChoiceSheet";
import { DELIVERY_METHODS } from "@/lib/config/deliveryMethods";
import { AdDetailSkeleton } from "@/components/ads/AdDetailSkeleton";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Truck, SearchX } from "lucide-react";
import { toast } from "@/lib/toast";
import { useStore, selectors, actions } from "@/lib/store";
import { createConversation } from "@/lib/api/chat";
import { getToken, ApiError } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import { recordView } from "@/lib/view-history";

export const Route = createFileRoute("/ads/$id")({
  head: () => ({
    meta: [
      { title: "Объявление — МоДелизМ" },
      { name: "description", content: "Объявление на МоДелизМ" },
    ],
  }),
  component: AdDetailPage,
});

type LoadState = "loading" | "ok" | "notFound" | "error";

/**
 * "Похожие объявления" up to SIMILAR_ADS_SLOTS, widening the match in tiers
 * rather than stopping at an exact category+subcategory match — otherwise a
 * narrow subcategory regularly has fewer than 12 listings and the row would
 * come up short. SimilarAds backfills anything still missing with
 * placeholder cards, so this only needs to gather as many *real* ads as
 * exist, closest match first; it never needs to pad itself.
 *
 * Tier order (relaxes one dimension at a time):
 *   1. same category + same subcategory (closest match)
 *   2. same category, different subcategory ("смежные направления")
 *   3. any other category (last resort, so the row is never mostly empty)
 * Mock ads have no real timestamp (createdAt is a display string like
 * "2 часа назад", not sortable) — list order in mock.ts is already
 * newest-first, so within a tier that order stands in for recency. A real
 * backend should sort each tier by actual publish date.
 *
 * The tiering (expand-by-direction) vs backend-driven "recent across all
 * categories" was assumed rather than confirmed — flagged for Nikita to
 * sign off before this ships to production.
 */
function pickSimilar(list: Ad[], current: Ad): Ad[] {
  const pool = list.filter((x) => x.id !== current.id);
  const tier1 = pool.filter((x) => x.category === current.category && x.subcategory === current.subcategory);
  const tier2 = pool.filter((x) => x.category === current.category && x.subcategory !== current.subcategory);
  const tier3 = pool.filter((x) => x.category !== current.category);

  const picked: Ad[] = [];
  const seen = new Set<string>();
  for (const tier of [tier1, tier2, tier3]) {
    for (const item of tier) {
      if (picked.length >= SIMILAR_ADS_SLOTS) return picked;
      if (seen.has(item.id)) continue;
      seen.add(item.id);
      picked.push(item);
    }
  }
  return picked;
}

function AdDetailPage() {
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const me = useStore(selectors.currentUser);
  const [ad, setAd] = useState<Ad | null>(null);
  const [similar, setSimilar] = useState<Ad[]>([]);
  const [state, setState] = useState<LoadState>("loading");
  const saved = useStore(selectors.isAdFavorite(id));

  useEffect(() => {
    let alive = true;
    setState("loading");
    fetchListing(id)
      .then((a) => {
        if (!alive) return;
        setAd(a);
        setState("ok");
        recordView({ id: a.id, kind: "ad", title: a.title, thumb: a.image });
        fetchListings()
          .then((list) => setSimilar(pickSimilar(list, a)))
          .catch(() => setSimilar([]));
      })
      .catch((err) => {
        if (!alive) return;
        setAd(null);
        setState(err instanceof ApiError && err.status === 404 ? "notFound" : "error");
      });
    return () => {
      alive = false;
    };
  }, [id]);

  const [deliveryPickerOpen, setDeliveryPickerOpen] = useState(false);

  const availableDeliveryMethods = useMemo(
    () => (ad?.delivery ?? []).filter((d) => DELIVERY_METHODS.some((m) => m.label === d)),
    [ad],
  );

  const revealedPhone = useStore((s) => s.revealedPhones[id]) ?? null;
  const [phoneLoading, setPhoneLoading] = useState(false);

  const revealPhone = async () => {
    if (!getToken() && !isDemoMode()) {
      toast.info("Войдите, чтобы посмотреть номер");
      navigate({ to: "/login" });
      return;
    }
    if (revealedPhone || phoneLoading) return;
    setPhoneLoading(true);
    try {
      const phone = await revealSellerPhone(id);
      actions.setRevealedPhone(id, phone);
    } catch {
      toast.error("Не удалось получить номер");
    } finally {
      setPhoneLoading(false);
    }
  };

  const proceedToConversation = async (queuedMessage: string | null) => {
    const sellerId = ad?.seller?.numericId;
    if (!sellerId || !me) {
      toast.error("Не удалось открыть диалог с продавцом");
      return;
    }
    try {
      const dialog = await createConversation(sellerId, me.id, ad.id);
      if (ad) {
        actions.setDialogAd(dialog.id, {
          id: ad.id,
          title: ad.title,
          price: ad.price,
          image: ad.gallery?.[0] ?? ad.image,
        });
      }
      if (queuedMessage) {
        actions.queuePendingMessage(dialog.id, queuedMessage);
      }
      navigate({ to: "/messenger", search: { chat: dialog.id } });
    } catch {
      toast.error("Не удалось открыть диалог");
    }
  };

  const requireAuthAndNotOwnAd = (): boolean => {
    if (!getToken() && !isDemoMode()) {
      toast.info("Войдите, чтобы написать продавцу");
      navigate({ to: "/login" });
      return false;
    }
    if (me && ad?.seller?.numericId && me.numericId === ad.seller.numericId) {
      toast.info("Это ваше объявление");
      return false;
    }
    return true;
  };

  const writeToSeller = async () => {
    if (!requireAuthAndNotOwnAd()) return;
    if (availableDeliveryMethods.length > 0) {
      setDeliveryPickerOpen(true);
      return;
    }
    await proceedToConversation(null);
  };

  const askSeller = async (question: string) => {
    if (!requireAuthAndNotOwnAd()) return;
    await proceedToConversation(question);
  };

  if (state === "loading") {
    return (
      <AppLayout rightColumn={false}>
        <AdDetailSkeleton />
      </AppLayout>
    );
  }

  if (state === "notFound") {
    return (
      <AppLayout rightColumn={false}>
        <div className="mx-auto max-w-[560px] py-[40px]">
          <EmptyState
            icon={SearchX}
            title="Объявление не найдено"
            description="Возможно, оно было продано, снято с публикации или ссылка устарела."
            action={{ label: "К списку объявлений", onClick: () => navigate({ to: "/ads" }) }}
          />
        </div>
      </AppLayout>
    );
  }

  if (state === "error" || !ad) {
    return (
      <AppLayout rightColumn={false}>
        <div className="mx-auto max-w-[560px] py-[40px]">
          <Alert variant="error">
            <AlertTitle>Не удалось загрузить объявление</AlertTitle>
            <AlertDescription>Проверьте соединение и попробуйте ещё раз.</AlertDescription>
            <div className="mt-[12px] flex gap-[8px]">
              <Button size="sm" onClick={() => navigate({ to: "/ads/$id", params: { id } })}>
                Повторить
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate({ to: "/ads" })}>
                К списку
              </Button>
            </div>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  const images = ad.gallery && ad.gallery.length ? ad.gallery : [ad.image];

  const share = async () => {
    const url = typeof window !== "undefined" ? window.location.href : "";
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await (navigator as Navigator).share({ title: ad.title, url });
        return;
      } catch {
        /* user cancelled — fall through to copy */
      }
    }
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(url);
        toast.success("Ссылка скопирована");
        return;
      } catch {
        /* clipboard blocked */
      }
    }
    toast.info("Скопируйте ссылку из адресной строки");
  };

  const toggleSave = async () => {
    if (!getToken() && !isDemoMode()) {
      toast.info("Войдите, чтобы добавить в избранное");
      navigate({ to: "/login" });
      return;
    }
    actions.toggleFavoriteAd(id);
    if (!isDemoMode()) {
      try {
        if (saved) await removeFavoriteListing(id);
        else await addFavoriteListing(id);
      } catch {
        actions.toggleFavoriteAd(id);
        toast.error("Не удалось обновить избранное", { id: "favorite-toggle" });
        return;
      }
    }
    // Fixed id: rapid taps replace the previous toast instead of stacking.
    toast.success(saved ? "Убрано из избранного" : "В избранное", { id: "favorite-toggle" });
  };

  const hasDelivery = ad.delivery.length > 0;

  return (
    <AppLayout rightColumn={false}>
      <div
        className="mx-auto max-w-[1100px] pb-[calc(var(--bottom-nav-space)+72px)] lg:pb-0"
      >
        {/* Breadcrumbs */}
        <nav className="mb-[16px] flex flex-wrap items-center gap-[6px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
          <Link to="/ads" className="inline-flex items-center gap-[4px] transition-colors hover:text-[var(--foreground)]">
            <ChevronLeft size={14} /> Объявления
          </Link>
          {ad.category && (
            <>
              <span>/</span>
              <span style={{ color: "var(--foreground-70)" }}>{ad.category}</span>
            </>
          )}
          {ad.subcategory && (
            <>
              <span>/</span>
              <span style={{ color: "var(--foreground)" }}>{ad.subcategory}</span>
            </>
          )}
        </nav>

        {/* Avito-style structure via named grid areas — the actual fix for
            "правый блок не закреплён при скролле": the old markup put the
            sticky wrapper inside a grid row that ended right after the
            gallery, so it released the moment that row scrolled past.
            Named areas let "actions" span the full height of the page
            (sticky the whole way through description/delivery/seller/
            similar) while still reordering naturally on mobile: gallery,
            then price/actions/ask-seller, then the rest — matching where
            Avito puts title+price on its mobile listing page, just above
            the description, rather than only in the fixed bottom bar. */}
        <div
          className="grid gap-[16px] lg:grid-cols-[1fr_360px] lg:items-start lg:gap-[24px] [grid-template-areas:'gallery'_'actions'_'content'] lg:[grid-template-areas:'gallery_actions'_'content_actions']"
        >
          <div className="min-w-0 [grid-area:gallery]">
            <AdGallery images={images} alt={ad.title} />
          </div>

          <div className="flex flex-col gap-[16px] [grid-area:actions] lg:sticky lg:top-[16px]">
            <AdActionPanel
              ad={ad}
              saved={saved}
              onWrite={writeToSeller}
              onToggleSave={toggleSave}
              onShare={share}
              phoneRevealState={phoneLoading ? "loading" : revealedPhone ? "revealed" : "idle"}
              revealedPhone={revealedPhone}
              onRevealPhone={() => void revealPhone()}
            />
            <AskSellerWidget onAsk={(q) => void askSeller(q)} />
          </div>

          <div className="flex min-w-0 flex-col gap-[16px] [grid-area:content] lg:gap-[20px]">

            {/* Description */}
            <Card
              className="p-[16px] sm:p-[20px]"
              style={{
                background: "var(--background-elevated)",
                borderColor: "var(--border)",
                borderRadius: "var(--r-card)",
                boxShadow: "var(--shadow-card)",
              }}
            >
              <h2 className="font-display text-[16px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
                Описание
              </h2>
              <p className="mt-[8px] whitespace-pre-line text-[14px] leading-[1.55]" style={{ color: "var(--foreground-90)" }}>
                {ad.description ?? "Описание отсутствует."}
              </p>

              <div className="mt-[14px] grid gap-[10px] sm:grid-cols-3" style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}>
                <Spec label="Категория" value={[ad.category, ad.subcategory].filter(Boolean).join(" · ") || "—"} />
                <Spec label="Состояние" value={ad.condition ?? "—"} />
                <Spec label="Город" value={ad.city || "—"} />
              </div>
            </Card>

            {/* Delivery — only when the listing declares options */}
            {hasDelivery && (
              <Card
                className="p-[16px] sm:p-[20px]"
                style={{
                  background: "var(--background-elevated)",
                  borderColor: "var(--border)",
                  borderRadius: "var(--r-card)",
                  boxShadow: "var(--shadow-card)",
                }}
              >
                <h2 className="font-display text-[16px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
                  Доставка
                </h2>
                <div className="mt-[8px] flex flex-wrap gap-[6px]">
                  {ad.delivery.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-[6px] px-[10px] py-[5px] text-[12px] font-medium"
                      style={{ background: "var(--background-surface)", color: "var(--foreground)", borderRadius: "var(--r-tag)" }}
                    >
                      <Truck size={12} /> {d}
                    </span>
                  ))}
                </div>
                {ad.deliveryDetails && (
                  <p className="mt-[10px] text-[13px] leading-[1.55]" style={{ color: "var(--foreground-70)" }}>
                    {ad.deliveryDetails}
                  </p>
                )}
              </Card>
            )}

            {/* Seller */}
            {ad.seller && <SellerCard seller={ad.seller} />}

            <SimilarAds items={similar} />
          </div>
        </div>
      </div>

      <MobileStickyActionBar
        ad={ad}
        onWrite={writeToSeller}
        phoneRevealState={phoneLoading ? "loading" : revealedPhone ? "revealed" : "idle"}
        revealedPhone={revealedPhone}
        onRevealPhone={() => void revealPhone()}
      />

      <DeliveryChoiceSheet
        open={deliveryPickerOpen}
        methods={availableDeliveryMethods}
        onConfirm={(choice) => {
          setDeliveryPickerOpen(false);
          void proceedToConversation(choice ? `📦 Способ получения: ${choice}` : null);
        }}
      />
    </AppLayout>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-[11px] font-semibold uppercase tracking-wider" style={{ color: "var(--foreground-50)" }}>{label}</div>
      <div className="mt-[4px] text-[14px] font-medium" style={{ color: "var(--foreground)" }}>{value}</div>
    </div>
  );
}
