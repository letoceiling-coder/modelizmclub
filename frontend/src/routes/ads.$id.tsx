import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AppLayout } from "@/components/layout/AppLayout";
import type { Ad } from "@/lib/mock";
import {
  fetchListing,
  fetchListings,
  addFavoriteListing,
  removeFavoriteListing,
  archiveListing,
  deleteListing,
} from "@/lib/api/listings";
import { AdGallery } from "@/components/ads/AdGallery";
import { SellerCard } from "@/components/ads/SellerCard";
import { SimilarAds, SIMILAR_ADS_SLOTS } from "@/components/ads/SimilarAds";
import { AdActionPanel } from "@/components/ads/AdActionPanel";
import { AdOwnerActionPanel } from "@/components/ads/AdOwnerActionPanel";
import { AdOwnerMobileBar } from "@/components/ads/AdOwnerMobileBar";
import { AskSellerWidget } from "@/components/ads/AskSellerWidget";
import { MobileStickyActionBar } from "@/components/ads/MobileStickyActionBar";
import { DELIVERY_METHODS } from "@/lib/config/deliveryMethods";
import { AdDetailSkeleton } from "@/components/ads/AdDetailSkeleton";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Truck, SearchX } from "lucide-react";
import { toast } from "@/lib/toast";
import { useStore, selectors, actions } from "@/lib/store";
import { useCurrentUser } from "@/lib/session";
import { openConversation } from "@/lib/api/chat";
import { ApiError } from "@/lib/api/client";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { isDemoMode } from "@/lib/demo-mode";
import { recordView } from "@/lib/view-history";
import { SafeDealCheckoutWizard } from "@/components/deals/SafeDealCheckoutWizard";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { ShareSheet } from "@/components/communities/ShareSheet";

import i18n from "@/lib/i18n";
import { useActionGate } from "@/lib/gate";
import { askConfirm } from "@/lib/ui/ask";

export const Route = createFileRoute("/ads/$id")({
  head: () => ({ meta: [{ title: i18n.t("pages.adDetail.metaTitle") }] }),
  component: AdDetailPage,
});

type LoadState = "loading" | "ok" | "notFound" | "error";

function buildSellerIntroMessage(
  ad: Ad,
  tr: (key: string, opts?: Record<string, string>) => string,
): string {
  return tr("pages.adDetail.sellerIntro", { title: ad.title });
}

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
  const tier1 = pool.filter(
    (x) => x.category === current.category && x.subcategory === current.subcategory,
  );
  const tier2 = pool.filter(
    (x) => x.category === current.category && x.subcategory !== current.subcategory,
  );
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
  const { t } = useTranslation();
  const { id } = Route.useParams();
  const navigate = useNavigate();
  const me = useCurrentUser();
  const { requireAccount } = useGuestAccess();
  const { requireAction } = useActionGate();
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

  const [previewAsBuyer, setPreviewAsBuyer] = useState(false);
  const [ownerBusy, setOwnerBusy] = useState(false);
  const [safeDealBusy] = useState(false);
  /*
   * Блок действий на экране — липкая полоса не нужна: она повторяла бы то,
   * что человек и так видит. Наблюдатель, а не расчёт прокрутки: высота
   * блока зависит от того, сколько кнопок доступно этому зрителю.
   */
  const actionPanelRef = useRef<HTMLDivElement>(null);
  const [actionsVisible, setActionsVisible] = useState(false);

  useEffect(() => {
    const el = actionPanelRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => setActionsVisible(entry.isIntersecting), {
      rootMargin: "0px 0px -72px 0px",
    });
    io.observe(el);
    return () => io.disconnect();
  }, [ad?.id]);
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);

  const proceedToConversation = async (queuedMessage: string | null) => {
    const sellerId = ad?.seller?.numericId;
    const sellerUuid = ad?.seller?.id;
    if (!sellerId || !sellerUuid || !me) {
      toast.error(t("pages.adDetail.sellerDialogFailed"));
      return;
    }
    try {
      const dialog = await openConversation(sellerId, me.id, sellerUuid, ad.id);
      if (queuedMessage) {
        actions.queuePendingMessage(dialog.id, queuedMessage);
      }
      navigate({ to: "/messenger", search: { chat: dialog.id } });
    } catch (err) {
      const message = formatApiErrorMessage(err, t("pages.adDetail.dialogOpenFailed"));
      if (message) toast.error(message);
    }
  };

  const requireAuthAndNotOwnAd = (actionKey: string, onAllowed: () => void): void => {
    void requireAction(actionKey, () => {
      if (me && ad?.seller?.numericId && me.numericId === ad.seller.numericId) {
        toast.info(t("pages.adDetail.ownListing"));
        return;
      }
      onAllowed();
    });
  };

  /*
   * «Написать продавцу» открывает переписку сразу.
   *
   * Раньше, если у объявления был указан хоть один способ доставки, сначала
   * показывалось окно «Способ получения». Человек нажимал «Написать
   * продавцу», а его спрашивали, как он хочет получить товар: спросить
   * «ещё продаётся?» было нельзя, не объявив сперва способ получения.
   * Доставку выбирают там, где она к месту, — в мастере безопасной сделки,
   * у него есть собственный шаг выбора.
   */
  const writeToSeller = () => {
    if (!ad) return;
    requireAuthAndNotOwnAd("ads.write_seller", () => {
      void proceedToConversation(buildSellerIntroMessage(ad, t));
    });
  };

  const startSafeDeal = () => {
    if (!ad) return;
    requireAuthAndNotOwnAd("ads.safe_deal", () => {
      if (isDemoMode()) {
        toast.info("Безопасная сделка доступна на боевом контуре после входа.");
        return;
      }
      setCheckoutOpen(true);
    });
  };

  const askSeller = (question: string) => {
    requireAuthAndNotOwnAd("ads.write_seller", () => {
      void proceedToConversation(question);
    });
  };

  if (state === "loading") {
    return (
      <AppLayout footer navCollapsed>
        <AdDetailSkeleton />
      </AppLayout>
    );
  }

  if (state === "notFound") {
    return (
      <AppLayout footer navCollapsed>
        <div className="mx-auto max-w-[560px] py-[40px]">
          <EmptyState
            icon={SearchX}
            title={t("pages.adDetail.notFoundTitle")}
            description={t("pages.adDetail.notFoundDesc")}
            action={{ label: t("pages.adDetail.toList"), onClick: () => navigate({ to: "/ads" }) }}
          />
        </div>
      </AppLayout>
    );
  }

  if (state === "error" || !ad) {
    return (
      <AppLayout footer navCollapsed>
        <div className="mx-auto max-w-[560px] py-[40px]">
          <Alert variant="error">
            <AlertTitle>{t("pages.adDetail.loadFailedTitle")}</AlertTitle>
            <AlertDescription>{t("pages.adDetail.loadFailedDesc")}</AlertDescription>
            <div className="mt-[12px] flex gap-[8px]">
              <Button size="sm" onClick={() => navigate({ to: "/ads/$id", params: { id } })}>
                {t("pages.shared.retry")}
              </Button>
              <Button size="sm" variant="outline" onClick={() => navigate({ to: "/ads" })}>
                {t("pages.adDetail.backToList")}
              </Button>
            </div>
          </Alert>
        </div>
      </AppLayout>
    );
  }

  const images = ad.galleryMedia?.length
    ? ad.galleryMedia
    : ad.gallery && ad.gallery.length
      ? ad.gallery
      : [ad.image];

  const share = () => setShareOpen(true);

  const toggleSave = () => {
    requireAccount(() => {
      void (async () => {
        actions.toggleFavoriteAd(id);
        if (!isDemoMode()) {
          try {
            let favoritesCount = ad.likes ?? 0;
            if (saved) {
              favoritesCount = await removeFavoriteListing(id);
            } else {
              favoritesCount = await addFavoriteListing(id);
            }
            setAd((prev) => (prev ? { ...prev, likes: favoritesCount } : prev));
          } catch {
            actions.toggleFavoriteAd(id);
            toast.error(t("pages.adDetail.favoriteFailed"), { id: "favorite-toggle" });
            return;
          }
        }
        toast.success(
          saved ? t("pages.adDetail.removedFromFavorites") : t("pages.adDetail.addedToFavorites"),
          { id: "favorite-toggle" },
        );
      })();
    });
  };

  const hasDelivery = ad.delivery.length > 0;

  const isOwner = Boolean(
    me &&
    ((ad.authorId && me.id === ad.authorId) ||
      (ad.seller?.id && me.id === ad.seller.id) ||
      (ad.seller?.numericId != null && me.numericId === ad.seller.numericId)),
  );
  const showBuyerUi = !isOwner || previewAsBuyer;

  const goEdit = () => navigate({ to: "/ads/new", search: { edit: ad.id } });

  const handleOwnerUnpublish = async () => {
    if (!(await askConfirm({ title: t("pages.adDetail.ownerUnpublishConfirm") }))) return;
    setOwnerBusy(true);
    try {
      await archiveListing(ad.id);
      toast.success(t("pages.adDetail.ownerUnpublished"));
      navigate({ to: "/my-ads" });
    } catch {
      toast.error(t("pages.adDetail.ownerActionFailed"));
    } finally {
      setOwnerBusy(false);
    }
  };

  const handleOwnerDelete = async () => {
    if (!(await askConfirm({ title: t("pages.adDetail.ownerDeleteConfirm") }))) return;
    setOwnerBusy(true);
    try {
      await deleteListing(ad.id);
      toast.success(t("pages.adDetail.ownerDeleted"));
      navigate({ to: "/my-ads" });
    } catch {
      toast.error(t("pages.adDetail.ownerActionFailed"));
    } finally {
      setOwnerBusy(false);
    }
  };

  return (
    // Меню свёрнуто, как в каталоге: из каталога в объявление и обратно
    // левая колонка не меняет ширину. Во всех четырёх состояниях страницы.
    <AppLayout footer navCollapsed>
      <div className="pb-[calc(var(--bottom-nav-space)+72px)] lg:pb-0">
        {/* Breadcrumbs */}
        <nav
          className="mb-[16px] flex flex-wrap items-center gap-[6px] text-[12px]"
          style={{ color: "var(--foreground-50)" }}
        >
          <Link
            to="/ads"
            className="inline-flex items-center gap-[4px] transition-colors hover:text-[var(--foreground)]"
          >
            <ChevronLeft size={14} /> {t("pages.adDetail.listingsBreadcrumb")}
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
        <div className="grid gap-[16px] lg:grid-cols-[1fr_360px] lg:items-start lg:gap-[24px] [grid-template-areas:'gallery'_'actions'_'content'] lg:[grid-template-areas:'gallery_actions'_'content_actions']">
          <div className="min-w-0 [grid-area:gallery]">
            <AdGallery images={images} alt={ad.title} reserved={ad.reserved} />
          </div>

          <div className="flex flex-col gap-[16px] [grid-area:actions] lg:sticky lg:top-[16px]">
            {previewAsBuyer && (
              <Alert variant="info" className="rounded-[var(--r-card)]">
                <AlertTitle>{t("pages.adDetail.previewModeTitle")}</AlertTitle>
                <AlertDescription className="flex flex-col gap-[8px]">
                  <span>{t("pages.adDetail.previewModeDesc")}</span>
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-fit"
                    onClick={() => setPreviewAsBuyer(false)}
                  >
                    {t("pages.adDetail.previewModeExit")}
                  </Button>
                </AlertDescription>
              </Alert>
            )}
            {showBuyerUi ? (
              <div ref={actionPanelRef}>
                <AdActionPanel
                  ad={ad}
                  saved={saved}
                  onWrite={writeToSeller}
                  onToggleSave={toggleSave}
                  onShare={share}
                  onSafeDeal={() => void startSafeDeal()}
                  safeDealBusy={safeDealBusy}
                />
              </div>
            ) : (
              <AdOwnerActionPanel
                ad={ad}
                busy={ownerBusy}
                onEdit={goEdit}
                onUnpublish={() => void handleOwnerUnpublish()}
                onDelete={() => void handleOwnerDelete()}
                onShare={share}
                onPreviewAsBuyer={() => setPreviewAsBuyer(true)}
              />
            )}
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
              <h2
                className="font-display text-[16px] font-bold"
                style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
              >
                {t("pages.adDetail.descriptionHeading")}
              </h2>
              <p
                className="mt-[8px] whitespace-pre-line text-[14px] leading-[1.55]"
                style={{ color: "var(--foreground-90)" }}
              >
                {ad.description ?? t("pages.adDetail.noDescription")}
              </p>

              <div
                className="mt-[14px] grid gap-[10px] sm:grid-cols-3"
                style={{ borderTop: "1px solid var(--border)", paddingTop: 14 }}
              >
                <Spec
                  label={t("pages.adDetail.specCategory")}
                  value={[ad.category, ad.subcategory].filter(Boolean).join(" · ") || "—"}
                />
                <Spec label={t("pages.adDetail.specCondition")} value={ad.condition ?? "—"} />
                <Spec label={t("pages.adDetail.specCity")} value={ad.city || "—"} />
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
                <h2
                  className="font-display text-[16px] font-bold"
                  style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}
                >
                  {t("pages.adDetail.deliveryHeading")}
                </h2>
                <div className="mt-[8px] flex flex-wrap gap-[6px]">
                  {ad.delivery.map((d) => (
                    <span
                      key={d}
                      className="inline-flex items-center gap-[6px] px-[10px] py-[5px] text-[12px] font-medium"
                      style={{
                        background: "var(--background-surface)",
                        color: "var(--foreground)",
                        borderRadius: "var(--r-tag)",
                      }}
                    >
                      <Truck size={12} /> {d}
                    </span>
                  ))}
                </div>
                {ad.deliveryDetails && (
                  <p
                    className="mt-[10px] text-[13px] leading-[1.55]"
                    style={{ color: "var(--foreground-70)" }}
                  >
                    {ad.deliveryDetails}
                  </p>
                )}
              </Card>
            )}

            {/* Seller, then the "ask the seller" quick-question widget directly
                beneath it — Avito-style placement: seller info first, then the
                way to contact them, in the main content column rather than the
                right rail. */}
            {showBuyerUi && ad.seller && <SellerCard seller={ad.seller} />}

            {showBuyerUi && <AskSellerWidget onAsk={(q) => void askSeller(q)} />}

            <SimilarAds items={similar} />
          </div>
        </div>
      </div>

      {showBuyerUi ? (
        /*
         * Липкая полоса — для тех мест страницы, где действий не видно.
         * Пока блок действий на экране, она повторяет его кнопку «Написать
         * продавцу» в ста пикселях под ней: два одинаковых действия рядом,
         * и повторяется при этом вторичное — главное здесь «Купить через
         * безопасную сделку». Замерено на 440.
         */
        !actionsVisible && <MobileStickyActionBar ad={ad} onWrite={writeToSeller} />
      ) : (
        <AdOwnerMobileBar
          ad={ad}
          busy={ownerBusy}
          onEdit={goEdit}
          onUnpublish={() => void handleOwnerUnpublish()}
        />
      )}

      {ad && (
        <ShareSheet
          open={shareOpen}
          onOpenChange={setShareOpen}
          url={typeof window !== "undefined" ? window.location.href : ""}
          title={ad.title}
        />
      )}
      {ad && <SafeDealCheckoutWizard open={checkoutOpen} onOpenChange={setCheckoutOpen} ad={ad} />}
    </AppLayout>
  );
}

function Spec({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div
        className="text-[11px] font-semibold uppercase tracking-wider"
        style={{ color: "var(--foreground-50)" }}
      >
        {label}
      </div>
      <div className="mt-[4px] text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
        {value}
      </div>
    </div>
  );
}
