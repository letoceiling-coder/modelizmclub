import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Ad } from "@/lib/mock";
import { fetchListing, fetchListings, addFavoriteListing, removeFavoriteListing } from "@/lib/api/listings";
import { AdGallery } from "@/components/ads/AdGallery";
import { SellerCard } from "@/components/ads/SellerCard";
import { SimilarAds } from "@/components/ads/SimilarAds";
import { AdActionPanel } from "@/components/ads/AdActionPanel";
import { DeliveryChoiceSheet } from "@/components/ads/DeliveryChoiceSheet";
import { DELIVERY_METHODS } from "@/lib/config/deliveryMethods";
import { AdDetailSkeleton } from "@/components/ads/AdDetailSkeleton";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Truck, SearchX } from "lucide-react";
import { toast } from "sonner";
import { useStore, selectors, actions } from "@/lib/store";
import { createConversation, sendMessage } from "@/lib/api/chat";
import { getToken, ApiError } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";

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
        fetchListings()
          .then((list) =>
            setSimilar(
              list
                .filter((x) => x.id !== a.id && (x.category === a.category || x.subcategory === a.subcategory))
                .slice(0, 8),
            ),
          )
          .catch(() => {});
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

  const proceedToConversation = async (deliveryChoice: string | null) => {
    const sellerId = ad?.seller?.numericId;
    if (!sellerId || !me) {
      toast.error("Не удалось открыть диалог с продавцом");
      return;
    }
    if (me.numericId === sellerId) {
      toast.info("Это ваше объявление");
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
      if (deliveryChoice) {
        await sendMessage(dialog.id, `📦 Способ получения: ${deliveryChoice}`);
      }
      navigate({ to: "/messenger", search: { chat: dialog.id } });
    } catch {
      toast.error("Не удалось открыть диалог");
    }
  };

  const writeToSeller = async () => {
    if (!getToken() && !isDemoMode()) {
      toast.info("Войдите, чтобы написать продавцу");
      navigate({ to: "/login" });
      return;
    }
    if (availableDeliveryMethods.length > 0) {
      setDeliveryPickerOpen(true);
      return;
    }
    await proceedToConversation(null);
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
        toast.error("Не удалось обновить избранное");
        return;
      }
    }
    toast.success(saved ? "Убрано из избранного" : "В избранное");
  };

  const hasDelivery = ad.delivery.length > 0;

  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto flex max-w-[1100px] flex-col gap-[24px]">
        {/* Breadcrumbs */}
        <nav className="flex flex-wrap items-center gap-[6px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
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

        {/* Top section: gallery + purchase panel */}
        <div className="grid gap-[24px] lg:grid-cols-[1fr_360px]">
          <div className="min-w-0">
            <AdGallery images={images} alt={ad.title} />
          </div>

          <div className="lg:sticky lg:top-[16px] lg:h-fit">
            <AdActionPanel
              ad={ad}
              saved={saved}
              onWrite={writeToSeller}
              onToggleSave={toggleSave}
              onShare={share}
            />
          </div>
        </div>

        {/* Description */}
        <Card
          className="p-[24px]"
          style={{
            background: "var(--background-elevated)",
            borderColor: "var(--border)",
            borderRadius: "var(--r-card)",
            boxShadow: "var(--shadow-card)",
          }}
        >
          <h2 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
            Описание
          </h2>
          <p className="mt-[12px] whitespace-pre-line text-[14px] leading-[1.6]" style={{ color: "var(--foreground-90)" }}>
            {ad.description ?? "Описание отсутствует."}
          </p>

          <div className="mt-[20px] grid gap-[12px] sm:grid-cols-3" style={{ borderTop: "1px solid var(--border)", paddingTop: 20 }}>
            <Spec label="Категория" value={[ad.category, ad.subcategory].filter(Boolean).join(" · ") || "—"} />
            <Spec label="Состояние" value={ad.condition ?? "—"} />
            <Spec label="Город" value={ad.city || "—"} />
          </div>
        </Card>

        {/* Delivery — only when the listing declares options */}
        {hasDelivery && (
          <Card
            className="p-[24px]"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              borderRadius: "var(--r-card)",
              boxShadow: "var(--shadow-card)",
            }}
          >
            <h2 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Доставка
            </h2>
            <div className="mt-[12px] flex flex-wrap gap-[8px]">
              {ad.delivery.map((d) => (
                <span
                  key={d}
                  className="inline-flex items-center gap-[6px] px-[12px] py-[6px] text-[12px] font-medium"
                  style={{ background: "var(--background-surface)", color: "var(--foreground)", borderRadius: "var(--r-tag)" }}
                >
                  <Truck size={12} /> {d}
                </span>
              ))}
            </div>
            {ad.deliveryDetails && (
              <p className="mt-[14px] text-[13px] leading-[1.6]" style={{ color: "var(--foreground-70)" }}>
                {ad.deliveryDetails}
              </p>
            )}
          </Card>
        )}

        {/* Seller */}
        {ad.seller && (
          <section className="space-y-[12px]">
            <h2 className="font-display text-[18px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
              Продавец
            </h2>
            <SellerCard seller={ad.seller} onWrite={writeToSeller} />
          </section>
        )}

        <SimilarAds items={similar} />
      </div>

      <DeliveryChoiceSheet
        open={deliveryPickerOpen}
        onClose={() => setDeliveryPickerOpen(false)}
        methods={availableDeliveryMethods}
        onConfirm={(choice) => {
          setDeliveryPickerOpen(false);
          void proceedToConversation(choice);
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
