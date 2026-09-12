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
import { CollapsibleText } from "@/components/ui/CollapsibleText";
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
  /*
   * Объявление грузится на сервере, а не в эффекте после гидрации.
   *
   * Без загрузчика главная фотография попадала в разметку только после того,
   * как отработал JS и ответил `/listings/{uuid}`: браузер узнавал её адрес
   * на 2822 мс, картинка приходила к 4289, LCP выходил 7,1 с. В разбивке
   * Lighthouse это 4413 мс «задержки обнаружения» из 7,1 с — больше половины.
   * С загрузчиком `img` есть в первом HTML, и предсканер находит её сразу
   * после документа. Тот же приём уже применён на `/post/{uuid}`.
   */
  loader: async ({ params }) => {
    /*
     * Со сроком: документ не должен ждать медленный API. Замер на сборке —
     * загрузчик добавляет к TTFB столько, сколько отвечает `/listings/{uuid}`
     * (локально 191 → 919 мс). Просроченный ответ не ломает страницу: она
     * рисуется как раньше, а объявление дотягивает клиент. Тот же приём и тот
     * же срок, что у загрузчика `/subscription`.
     */
    let timer: ReturnType<typeof setTimeout> | undefined;
    const deadline = new Promise<null>((resolve) => {
      timer = setTimeout(() => resolve(null), 1500);
    });
    try {
      const ad = await Promise.race([fetchListing(params.id), deadline]);
      return { ad: (ad as Ad | null) ?? null };
    } catch {
      /*
       * Отказ не делает страницу пустой: объявление может быть доступно с
       * токеном, которого на сервере нет. Компонент дотянет его на клиенте —
       * как было до этой правки.
       */
      return { ad: null as Ad | null };
    } finally {
      clearTimeout(timer);
    }
  },
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
  // Объявление с сервера — первый кадр уже с фотографией.
  const { ad: adFromServer } = Route.useLoaderData();
  const [ad, setAd] = useState<Ad | null>(adFromServer);
  const [similar, setSimilar] = useState<Ad[]>([]);
  const [state, setState] = useState<LoadState>(adFromServer ? "ok" : "loading");
  const saved = useStore(selectors.isAdFavorite(id));

  useEffect(() => {
    let alive = true;
    /*
     * Серверный ответ анонимен, поэтому запрос повторяется с токеном: права
     * зрителя (своё объявление, скрытое) сервер при отрисовке не знает.
     * Но состояние `loading` при этом не выставляем — иначе готовая с сервера
     * страница на миг схлопнулась бы в скелет и LCP снова уехал бы.
     */
    if (!adFromServer) setState("loading");
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
        // Серверная копия уже показана — не затираем её отказом клиента.
        if (adFromServer) return;
        setAd(null);
        setState(err instanceof ApiError && err.status === 404 ? "notFound" : "error");
      });
    return () => {
      alive = false;
    };
  }, [id, adFromServer]);

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
  /*
   * Ряд под описанием: доставка, продавец, «Спросите у продавца».
   *
   * «Спросите у продавца» уехал в левую колонку, под описание. Раньше он
   * стоял здесь, и на объявлении с коротким описанием правая колонка была
   * втрое выше левой: замер 12.09 на всех четырёх ширинах — левая 155 px,
   * правая 409, то есть 271 px пустоты шириной от 504 до 968.
   *
   * Условие теперь считает только то, что в колонке осталось. Со старым
   * (`hasDelivery || showBuyerUi`) у объявления без доставки покупатель
   * получил бы пустые 360 px справа.
   */
  const hasSideColumn = hasDelivery || showBuyerUi;

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

        {/*
          Компоновка как у Авито: две полосы и лента.

          Верх — галерея и цена с действиями, 1fr · 360. Ниже — не узкая
          колонка под галереей, а тоже две: слева описание и характеристики,
          справа доставка, продавец и «Спросите у продавца». Правая колонка
          той же ширины, что панель действий, — колонки стоят друг под
          другом. Похожие — во всю ширину, каруселью.

          До 11.09 всё ниже галереи шло одной колонкой в 1fr, а панель
          действий липла справа на всю высоту страницы: справа от описания,
          продавца и похожих оставалась пустая полоса в 360. Теперь панель
          липнет в пределах верхней полосы, а ниже справа — свой ряд блоков.

          Зазоры между блоками — 16 на телефоне, 24 от 1024 (было 16–48).
          На телефоне порядок прежний: галерея, цена и действия, описание,
          доставка, продавец, «Спросите», похожие.
        */}
        <div className="flex flex-col gap-[16px] lg:gap-[24px]">
          <div className="grid gap-[16px] lg:grid-cols-[minmax(0,1fr)_360px] lg:items-start lg:gap-[24px]">
            <div className="min-w-0">
              <AdGallery images={images} alt={ad.title} reserved={ad.reserved} />
            </div>

            <div className="flex flex-col gap-[16px] lg:sticky lg:top-[16px]">
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
          </div>

          {/*
            Вторая полоса: описание во всю ширину, под ним равновысокий ряд.

            Двухколоночная полоса в ноль не сходилась. Замер 12.09: с
            «Спросите» справа левая колонка была 155 px против 409 — 271 px
            пустоты шириной до 968. После переноса «Спросите» под описание
            осталось 126 px в колонке шириной 360. Меньше не выходит: описания
            в каталоге короткие, самое длинное из полусотни — 94 знака, и
            любые четыре блока в две колонки оставляют остаток в той, что ниже.

            Поэтому колонок больше нет. Описание занимает всю ширину, а
            доставка, продавец и «Спросите» стоят в один ряд равной высоты:
            грид растягивает ячейки, и пустого места на странице не остаётся.
            Порядок на телефоне прежний и держится теперь просто порядком в
            разметке — без `contents` и без дублей виджета.
          */}
          <div className="grid gap-[16px]">
            {/* Description */}
            <Card
              className="min-w-0 p-[16px]"
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
              {/*
                Длинное описание свёрнуто, как у ВКонтакте: 6 строк на
                телефоне, 16 от 1024 — примерно высота правой колонки рядом.
                Развернуть — «Показать полностью». До 11.09 описание в 2000
                знаков занимало 1100–1800 px и было самым высоким блоком.
              */}
              <CollapsibleText
                className="mt-[8px]"
                text={ad.description ?? t("pages.adDetail.noDescription")}
                maxLines={6}
                maxLinesLg={16}
              />

              <div
                className="mt-[12px] grid gap-[8px] sm:grid-cols-3"
                style={{ borderTop: "1px solid var(--border)", paddingTop: 12 }}
              >
                <Spec
                  label={t("pages.adDetail.specCategory")}
                  value={[ad.category, ad.subcategory].filter(Boolean).join(" · ") || "—"}
                />
                <Spec label={t("pages.adDetail.specCondition")} value={ad.condition ?? "—"} />
                <Spec label={t("pages.adDetail.specCity")} value={ad.city || "—"} />
              </div>
            </Card>

            {hasSideColumn && (
              /*
                Ряд блоков. `grid-flow-col` с `auto-cols-fr` делит ширину
                поровну между тем, что есть: доставки может не быть, карточки
                продавца у владельца тоже. Ячейки растягиваются по высоте, а
                `[&>*]:h-full` передаёт эту высоту внутрь блоков, у которых
                своей настройки высоты нет. Второй селектор — для карточки
                продавца: её корень это ссылка, и без него растягивалась
                ссылка, а видимая карточка внутри оставалась на 74 px при
                ячейке в 174 (замер 12.09 — моя же проверка сначала мерила
                ячейку и показывала «высоты равны», хотя дыра была).
              */
              <div className="grid gap-[16px] lg:auto-cols-fr lg:grid-flow-col lg:gap-[24px] lg:[&>*]:h-full lg:[&>a>*]:h-full">
                {/* Delivery — only when the listing declares options */}
                {hasDelivery && (
                  <Card
                    className="p-[16px]"
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
                    <div className="mt-[8px] flex flex-wrap gap-[8px]">
                      {ad.delivery.map((d) => (
                        <span
                          key={d}
                          className="inline-flex items-center gap-[4px] px-[8px] py-[4px] text-[12px] font-medium"
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
                        className="mt-[8px] text-[13px] leading-[1.55]"
                        style={{ color: "var(--foreground-70)" }}
                      >
                        {ad.deliveryDetails}
                      </p>
                    )}
                  </Card>
                )}

                {/* Продавец, затем «Спросите у продавца»: сначала кто, потом
                    как с ним связаться. На телефоне порядок тот же. */}
                {showBuyerUi && ad.seller && <SellerCard seller={ad.seller} />}

                {showBuyerUi && <AskSellerWidget onAsk={(q) => void askSeller(q)} />}
              </div>
            )}
          </div>

          <SimilarAds items={similar} />
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
