import { useEffect, useMemo, useState } from "react";
import { usePaymentAttempt } from "@/lib/payments/idempotency";
import { useNavigate } from "@tanstack/react-router";
import { isCdekDelivery, isPickupDelivery } from "@/lib/config/deliveryMethods";
import { Check, ChevronLeft, ChevronRight, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui-bespoke/Checkbox";
import type { Ad } from "@/lib/mock";
import { ApiError } from "@/lib/api/client";
import {
  fetchCdekPickupPoints,
  searchCdekCities,
  type CdekCity,
  type CdekPickupPoint,
} from "@/lib/api/cdek";
import {
  createSafeDeal,
  kopecksToRub,
  quoteSafeDeal,
  type SafeDealDestination,
  type SafeDealQuote,
} from "@/lib/api/safe-deals";
import { topupWallet } from "@/lib/api/wallet";
import { toast } from "@/lib/toast";
import { firstFieldError } from "@/lib/api/validationErrors";
import { искатьПункты } from "@/lib/delivery/pvz-search";
import { isYandexMapsConfigured } from "@/lib/delivery/yandex-maps";
import { pvzBounds } from "@/lib/delivery/pvz-features";
import { PickupPointsMap } from "@/components/deals/PickupPointsMap";
import { reportReadFailure } from "@/lib/errors/handle";

const FEE_PERCENT = 5;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ad: Ad;
}

function parcelLabel(ad: Ad): string {
  // Типоразмер S/M/L убран 22.09: за ним стояла придуманная коробка, тариф
  // считался по ней, а в пункт приёма приезжала настоящая.
  const dims = ad.dimensionsCm;
  const weight = ad.weightKg;
  const parts: string[] = [];
  if (dims?.length && dims.width && dims.height) {
    parts.push(`${dims.length}×${dims.width}×${dims.height} см`);
  }
  if (weight) parts.push(`${weight} кг`);
  return parts.join(" · ") || "Габариты не указаны";
}

export function SafeDealCheckoutWizard({ open, onOpenChange, ad }: Props) {
  const navigate = useNavigate();

  /*
   * Способы, которые предлагает продавец, и тот, что выбрал покупатель.
   *
   * До 07.09 выбора не было: мастер, как и сервер, ветвился по набору
   * продавца, и у объявления с «СДЭК + Самовывоз» побеждал СДЭК. Покупателя
   * заставляли выбрать ПВЗ, а самовывоз оказывался недостижим ровно там, где
   * предложен вместе с доставкой.
   */
  const methods = useMemo(
    () => (ad.delivery ?? []).map((m) => String(m).trim()).filter(Boolean),
    [ad.delivery],
  );
  const [method, setMethod] = useState<string | null>(null);
  const chosen = method ?? (methods.length === 1 ? methods[0] : null);
  const offersCdek = chosen !== null && isCdekDelivery(chosen);
  const itemKopecks = Math.round(ad.price * 100);
  const feeKopecks = Math.round((itemKopecks * FEE_PERCENT) / 100);

  const [step, setStep] = useState(1);
  // Ключ попытки пополнения: недостаток средств ловится при каждом нажатии
  // «Оформить», и без общего ключа каждое давало бы свой заказ в банке.
  const attempt = usePaymentAttempt();
  const [cityQuery, setCityQuery] = useState("");
  const [cities, setCities] = useState<CdekCity[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CdekCity | null>(null);
  const [points, setPoints] = useState<CdekPickupPoint[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<CdekPickupPoint | null>(null);
  const [pointQuery, setPointQuery] = useState("");
  const [pointsFailed, setPointsFailed] = useState(false);
  const [pointsReload, setPointsReload] = useState(0);
  const [pointsView, setPointsView] = useState<"list" | "map">("list");
  const [mapBroken, setMapBroken] = useState(false);
  const [quote, setQuote] = useState<SafeDealQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setMethod(null);
    setCityQuery("");
    setCities([]);
    setSelectedCity(null);
    setPoints([]);
    setPointsFailed(false);
    setMapBroken(false);
    setPointQuery("");
    setPointsView("list");
    setSelectedPoint(null);
    setQuote(null);
    setAcceptTerms(false);
  }, [open, ad.id]);

  // A СДЭК listing gets its quote once a pickup point is chosen; everything
  // else can be priced right away, and the quote also tells us whether the
  // bank will hold the money or charge it.
  useEffect(() => {
    if (!open || offersCdek || !chosen) return;
    let alive = true;
    void quoteSafeDeal(ad.id, undefined, chosen)
      .then((q) => {
        if (alive) setQuote(q);
      })
      .catch(() => {
        /* the summary falls back to local numbers */
      });
    return () => {
      alive = false;
    };
  }, [open, offersCdek, chosen, ad.id]);

  useEffect(() => {
    if (!open || cityQuery.trim().length < 2) {
      setCities([]);
      return;
    }
    let alive = true;
    setCityLoading(true);
    const t = window.setTimeout(() => {
      void searchCdekCities(cityQuery)
        .then((rows) => {
          if (alive) setCities(rows.slice(0, 8));
        })
        .catch(() => {
          if (alive) setCities([]);
        })
        .finally(() => {
          if (alive) setCityLoading(false);
        });
    }, 280);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [cityQuery, open]);

  useEffect(() => {
    setPointQuery("");
    setPointsFailed(false);
    setPointsView("list");
    if (!selectedCity) {
      setPoints([]);
      return;
    }
    let alive = true;
    setPointsLoading(true);
    void fetchCdekPickupPoints(selectedCity.code)
      .then((rows) => {
        if (alive) setPoints(rows);
      })
      .catch((e) => {
        /*
         * Пустой список и «не загрузилось» на экране неразличимы, а решения
         * человек принимает разные: в первом случае он меняет город, во
         * втором — повторяет.
         *
         * `reportReadFailure` только записывает отказ — отрисовка на месте
         * вызова. Без неё шаг оставался пустым: ни списка, ни поля поиска, ни
         * единого слова, и «Далее» заблокирована — тупик посреди оформления.
         */
        reportReadFailure(e, "пункты выдачи СДЭК");
        if (!alive) return;
        setPoints([]);
        setPointsFailed(true);
      })
      .finally(() => {
        if (alive) setPointsLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [selectedCity, pointsReload]);

  const visiblePoints = useMemo(() => искатьПункты(points, pointQuery), [points, pointQuery]);

  /*
   * Карту показываем, только когда её есть чем наполнить. Переключатель и
   * сама карта раньше считали это по-разному: переключатель — по числу
   * пунктов, карта — по числу пунктов **с координатами**. В городе, где СДЭК
   * координат не проставил, человек нажимал «На карте» и видел пустоту, а
   * список в этот момент был скрыт.
   */
  const картаВозможна = isYandexMapsConfigured() && !mapBroken && pvzBounds(visiblePoints) !== null;

  const destination: SafeDealDestination | undefined = useMemo(() => {
    if (!selectedCity || !selectedPoint) return undefined;
    return {
      city_code: selectedCity.code,
      external_point_id: selectedPoint.id,
      name: selectedPoint.name,
      address: selectedPoint.address ?? undefined,
      latitude: selectedPoint.latitude ?? undefined,
      longitude: selectedPoint.longitude ?? undefined,
    };
  }, [selectedCity, selectedPoint]);

  const loadQuote = async () => {
    if (!offersCdek || !destination) return;
    setQuoteLoading(true);
    try {
      const q = await quoteSafeDeal(ad.id, destination, chosen);
      setQuote(q);
    } catch (err) {
      toast.error(
        firstFieldError(
          (err as ApiError).errors,
          err instanceof Error ? err.message : "Не удалось рассчитать доставку",
        ),
      );
    } finally {
      setQuoteLoading(false);
    }
  };

  const goNext = () => {
    if (step === 1) {
      if (!chosen) {
        toast.error("Выберите способ доставки");
        return;
      }
      setStep(offersCdek ? 2 : 3);
      return;
    }
    if (step === 2) {
      if (!destination) {
        toast.error("Выберите пункт выдачи СДЭК");
        return;
      }
      void loadQuote().then(() => setStep(3));
    }
  };

  const pay = async () => {
    if (!acceptTerms) {
      toast.error("Нужно согласие с Правилами безопасной сделки");
      return;
    }
    setBusy(true);
    try {
      const deal = await createSafeDeal(ad.id, {
        acceptTerms,
        destination,
        deliveryMethod: chosen,
      });

      // VTB deals finish on the bank's card form; wallet deals are already held.
      if (deal.checkout_url) {
        onOpenChange(false);
        window.location.href = deal.checkout_url;
        return;
      }

      toast.success("Сделка создана, средства заморожены на балансе.");
      onOpenChange(false);
      void navigate({ to: "/deals/$uuid", params: { uuid: deal.uuid }, search: { role: "buyer" } });
    } catch (err) {
      const insufficient = err instanceof ApiError && Boolean(err.errors?.balance);
      if (insufficient) {
        const hold = quote?.hold_kopecks ?? itemKopecks;
        const needRub = Math.max(100, Math.ceil(hold / 100));
        toast.error("Недостаточно средств. Пополните баланс через ВТБ.");
        try {
          const checkout = await topupWallet(
            needRub,
            attempt.key(`topup:${needRub}`),
            window.location.href,
          );
          if (checkout.checkout_url) {
            window.location.href = checkout.checkout_url;
            return;
          }
        } catch {
          void navigate({ to: "/settings/wallet" });
        }
      } else {
        toast.error(
          firstFieldError(
            (err as ApiError).errors,
            err instanceof Error ? err.message : "Не удалось создать сделку",
          ),
        );
      }
    } finally {
      setBusy(false);
    }
  };

  const delivery = quote?.delivery_cost_kopecks ?? 0;
  const hold = quote?.hold_kopecks ?? itemKopecks + delivery;
  const holdsOnCard = quote?.escrow_holds_on_card ?? true;
  // Кошелёк площадки: карты в этой сделке не будет ни на одном шаге.
  const payFromWallet = quote?.escrow_provider === "wallet";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="max-h-[90vh] max-w-[560px] overflow-y-auto"
        style={{ background: "var(--background)", borderColor: "var(--border)" }}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-[8px]">
            <ShieldCheck size={18} style={{ color: "var(--accent)" }} />
            Безопасная сделка
          </DialogTitle>
        </DialogHeader>

        <div className="mb-[12px] flex gap-[6px] text-[12px] font-semibold">
          {[1, offersCdek ? 2 : null, 3]
            .filter((s): s is number => s !== null)
            .map((s) => (
              <span
                key={s}
                className="rounded-full px-[10px] py-[4px]"
                style={{
                  background: step === s ? "var(--accent)" : "var(--background-surface)",
                  color: step === s ? "var(--accent-foreground)" : "var(--foreground-50)",
                }}
              >
                {s === 1 ? "1. Заказ" : s === 2 ? "2. СДЭК" : `${offersCdek ? "3" : "2"}. Оплата`}
              </span>
            ))}
        </div>

        {step === 1 && (
          <div className="space-y-[12px]">
            <div
              className="flex gap-[12px] rounded-[var(--r-card)] p-[12px]"
              style={{ background: "var(--background-surface)" }}
            >
              {ad.image ? (
                <img
                  src={ad.image}
                  width={72}
                  height={72}
                  loading="lazy"
                  decoding="async"
                  alt=""
                  className="h-[72px] w-[72px] rounded-[10px] object-cover"
                />
              ) : (
                <div
                  className="h-[72px] w-[72px] rounded-[10px]"
                  style={{ background: "var(--border)" }}
                />
              )}
              <div className="min-w-0">
                <div className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {ad.title}
                </div>
                <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
                  {ad.city || "Город не указан"}
                </div>
              </div>
            </div>
            <Row label="Стоимость товара" value={`${ad.price.toLocaleString("ru-RU")} ₽`} />
            <Row
              label={`Комиссия платформы (${FEE_PERCENT}%)`}
              value={`${kopecksToRub(feeKopecks)} ₽`}
            />
            <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              5% удерживается из выплаты продавцу и отображается здесь явно.
            </p>
            <Row label="Габариты и вес" value={parcelLabel(ad)} />

            {methods.length > 1 && (
              <div className="space-y-[8px]">
                <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                  Как получите товар
                </div>
                <div className="flex flex-wrap gap-[8px]">
                  {methods.map((m) => {
                    const active = chosen === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setMethod(m)}
                        className="min-h-[40px] rounded-[var(--r-tag)] border px-[14px] text-[13px] font-semibold transition-colors"
                        style={{
                          borderColor: active ? "var(--accent)" : "var(--border)",
                          background: active ? "var(--accent-soft)" : "var(--background-elevated)",
                          color: active ? "var(--accent)" : "var(--foreground-70)",
                        }}
                      >
                        {m}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                  {chosen === null
                    ? "Выберите способ — от него зависит стоимость доставки."
                    : isPickupDelivery(chosen)
                      ? "Самовывоз: доставка не оплачивается, пункт выдачи выбирать не нужно."
                      : "Пункт выдачи выберете на следующем шаге."}
                </p>
              </div>
            )}
          </div>
        )}

        {step === 2 && offersCdek && (
          <div className="space-y-[12px]">
            <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
              Город получения
            </label>
            <Input
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Начните вводить город"
            />
            {cityLoading && (
              <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                Поиск городов…
              </div>
            )}
            {cities.length > 0 && (
              <div className="flex max-h-[140px] flex-col gap-[4px] overflow-y-auto">
                {cities.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    className="rounded-[8px] px-[10px] py-[8px] text-left text-[13px]"
                    style={{
                      background:
                        selectedCity?.code === c.code
                          ? "var(--accent-soft)"
                          : "var(--background-surface)",
                      color: "var(--foreground)",
                    }}
                    onClick={() => {
                      setSelectedCity(c);
                      setCityQuery(c.city);
                      setSelectedPoint(null);
                      setQuote(null);
                    }}
                  >
                    {c.city}
                    {c.region ? `, ${c.region}` : ""}
                  </button>
                ))}
              </div>
            )}

            {pointsLoading && (
              <div
                className="flex items-center gap-[8px] text-[13px]"
                style={{ color: "var(--foreground-50)" }}
              >
                <Loader2 size={14} className="animate-spin" /> Загрузка ПВЗ…
              </div>
            )}

            {pointsFailed && (
              <div
                className="flex items-start justify-between gap-[10px] rounded-[10px] px-[10px] py-[8px]"
                style={{
                  border: "1px solid var(--border)",
                  background: "var(--background-elevated)",
                }}
                role="status"
              >
                <span className="text-[13px]" style={{ color: "var(--foreground-70)" }}>
                  Не удалось загрузить пункты выдачи.
                </span>
                <button
                  type="button"
                  className="shrink-0 text-[13px] font-semibold"
                  style={{ color: "var(--accent)" }}
                  onClick={() => setPointsReload((n) => n + 1)}
                >
                  Повторить
                </button>
              </div>
            )}

            {/*
              Выбранный пункт остаётся на виду, даже когда фильтр его прячет.
              Иначе человек, выбравший ПВЗ на Ленина и набравший потом
              «Тверская», видит список без единой подсветки — и кнопку
              «Далее», которая уводит дальше с прежним, невидимым выбором.
            */}
            {selectedPoint && !visiblePoints.some((p) => p.id === selectedPoint.id) && (
              <div
                className="flex items-start justify-between gap-[10px] rounded-[10px] px-[10px] py-[8px]"
                style={{ border: "1px solid var(--accent)", background: "var(--accent-soft)" }}
              >
                <span className="min-w-0 text-[12px]" style={{ color: "var(--foreground-70)" }}>
                  Выбрано: {selectedPoint.name}
                  {selectedPoint.address ? ` · ${selectedPoint.address}` : ""}
                </span>
                <button
                  type="button"
                  className="shrink-0 text-[12px] font-semibold"
                  style={{ color: "var(--accent)" }}
                  onClick={() => {
                    setSelectedPoint(null);
                    setQuote(null);
                  }}
                >
                  Сбросить
                </button>
              </div>
            )}

            {/*
              Переключатель — только на телефоне. На широком экране карта и
              список помещаются вместе, и прятать одно за другим значило бы
              отнимать у человека то, что и так видно.
            */}
            {картаВозможна && (
              <div className="flex gap-1.5 sm:hidden">
                {(
                  [
                    ["list", "Списком"],
                    ["map", "На карте"],
                  ] as const
                ).map(([вид, подпись]) => (
                  <button
                    key={вид}
                    type="button"
                    /*
                     * Кнопки, а не вкладки. `role="tab"` без `tabpanel` и
                     * без стрелок на клавиатуре — обещание, которого нет:
                     * диктор объявляет вкладки, которые ничем не управляют.
                     */
                    aria-pressed={pointsView === вид}
                    className="min-h-[36px] flex-1 rounded-[var(--r-tag)] border text-[13px] font-semibold"
                    style={{
                      borderColor: pointsView === вид ? "var(--accent)" : "var(--border)",
                      background:
                        pointsView === вид ? "var(--accent-soft)" : "var(--background-elevated)",
                      color: pointsView === вид ? "var(--accent)" : "var(--foreground-70)",
                    }}
                    onClick={() => setPointsView(вид)}
                  >
                    {подпись}
                  </button>
                ))}
              </div>
            )}

            {картаВозможна && (
              <PickupPointsMap
                points={visiblePoints}
                selectedId={selectedPoint?.id ?? null}
                onSelect={(p) => {
                  setSelectedPoint(p);
                  setQuote(null);
                }}
                onUnavailable={() => {
                  // Список снова становится единственным путём — и он должен
                  // быть на экране, а не за переключателем.
                  setMapBroken(true);
                  setPointsView("list");
                }}
                className={pointsView === "map" ? "" : "hidden sm:block"}
              />
            )}

            {points.length > 0 && (
              <div className={pointsView === "map" ? "hidden sm:block" : "space-y-[6px]"}>
                {/*
                  Поиск по адресам, которые уже пришли в ответе: геокодер тут
                  не нужен. В Москве и Петербурге пунктов под две сотни, и до
                  этого человек листал их глазами — притом что ищет он улицу,
                  а названия у СДЭК служебные («MSK1234»).
                */}
                <Input
                  type="search"
                  value={pointQuery}
                  onChange={(e) => setPointQuery(e.target.value)}
                  placeholder="Улица или дом — например, Ленина 12"
                  aria-label="Поиск пункта выдачи по адресу"
                />
                {/*
                  Живая область: список меняется молча, и без неё экранный
                  диктор не сообщает, что нашлось, а что нет.
                */}
                <p
                  className="text-[12px]"
                  style={{ color: "var(--foreground-50)" }}
                  role="status"
                  aria-live="polite"
                >
                  {pointQuery.trim()
                    ? `Найдено ${visiblePoints.length} из ${points.length}`
                    : `Пунктов в городе: ${points.length}`}
                </p>
              </div>
            )}

            {points.length > 0 && visiblePoints.length === 0 && (
              <p
                className="text-[13px]"
                style={{ color: "var(--foreground-70)" }}
                role="status"
                aria-live="polite"
              >
                По этому адресу пунктов нет.{" "}
                <button
                  type="button"
                  className="font-semibold"
                  style={{ color: "var(--accent)" }}
                  onClick={() => setPointQuery("")}
                >
                  Очистить поиск
                </button>
              </p>
            )}

            <div
              className={
                pointsView === "map"
                  ? "hidden sm:flex sm:max-h-[220px] sm:flex-col sm:gap-[6px] sm:overflow-y-auto"
                  : "flex max-h-[220px] flex-col gap-[6px] overflow-y-auto"
              }
            >
              {visiblePoints.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex items-start gap-[8px] rounded-[10px] px-[10px] py-[8px] text-left"
                  style={{
                    border:
                      selectedPoint?.id === p.id
                        ? "1px solid var(--accent)"
                        : "1px solid var(--border)",
                    background:
                      selectedPoint?.id === p.id
                        ? "var(--accent-soft)"
                        : "var(--background-elevated)",
                  }}
                  onClick={() => {
                    setSelectedPoint(p);
                    setQuote(null);
                  }}
                >
                  <MapPin
                    size={14}
                    className="mt-[2px] shrink-0"
                    style={{ color: "var(--accent)" }}
                  />
                  <span className="min-w-0">
                    <span
                      className="block text-[13px] font-semibold"
                      style={{ color: "var(--foreground)" }}
                    >
                      {p.name}
                    </span>
                    <span className="block text-[12px]" style={{ color: "var(--foreground-50)" }}>
                      {p.address}
                    </span>
                  </span>
                </button>
              ))}
            </div>
            {selectedPoint && (
              <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                Стоимость доставки рассчитается по габаритам объявления и округлится до 50/100 ₽.
              </p>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="space-y-[12px]">
            <Row label="Товар" value={`${kopecksToRub(quote?.item_kopecks ?? itemKopecks)} ₽`} />
            <Row
              label={`Комиссия ${FEE_PERCENT}%`}
              value={`${kopecksToRub(quote?.platform_fee_kopecks ?? feeKopecks)} ₽`}
            />
            <Row
              label={offersCdek ? "Доставка СДЭК" : "Доставка"}
              value={
                offersCdek
                  ? `${kopecksToRub(delivery)} ₽`
                  : chosen && isPickupDelivery(chosen)
                    ? "самовывоз, бесплатно"
                    : "по договорённости"
              }
            />
            {/*
              Доставка дороже товара — не ошибка, но и не мелочь: у песочницы
              СДЭК тариф до Краснодара выходил 1900 ₽ при товаре 1500 ₽.
              Покупатель должен увидеть это до оплаты, а не в чеке.
            */}
            {offersCdek && delivery > 0 && delivery >= (quote?.item_kopecks ?? itemKopecks) && (
              <p
                className="rounded-[var(--r-card)] px-[12px] py-[10px] text-[13px] leading-[1.4]"
                style={{ background: "var(--warning-soft)", color: "var(--warning)" }}
              >
                Доставка {kopecksToRub(delivery)} ₽ — это дороже самого товара (
                {kopecksToRub(quote?.item_kopecks ?? itemKopecks)} ₽). Проверьте пункт выдачи: ближе
                к вам может быть дешевле.
              </p>
            )}
            <Row
              label={holdsOnCard && !payFromWallet ? "К оплате (холд)" : "К оплате"}
              value={`${kopecksToRub(hold)} ₽`}
              emphasize
            />
            {selectedPoint && (
              <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                ПВЗ: {selectedPoint.name}
                {selectedPoint.address ? ` · ${selectedPoint.address}` : ""}
              </p>
            )}
            {/*
              Ссылка — строкой под чекбоксом, по его левому краю. Оба узла
              строчные (inline-flex и a), и в одном блоке ссылка вставала в ту
              же строку: от 768 «Открыть правила в новой» справа от чекбокса,
              «вкладке» — обрывком на следующей строке (замер 16.09 на проде,
              окно 520 px). На 375 чекбокс занимал строку целиком, и там
              ссылка случайно стояла верно.
            */}
            <div className="flex flex-col items-start gap-[8px]">
              <Checkbox
                checked={acceptTerms}
                onChange={setAcceptTerms}
                label="Согласен с Правилами безопасной сделки"
              />
              <a
                href="/rules/safe-deal"
                target="_blank"
                rel="noreferrer"
                className="text-[12px] font-medium"
                style={{ color: "var(--accent)" }}
              >
                Открыть правила в новой вкладке
              </a>
            </div>
            <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              {/* Текст обязан совпадать с тем, что произойдёт на самом деле.
                  При эскроу на кошельке карта не участвует вовсе: сумма
                  замораживается на балансе площадки и оттуда же возвращается.
                  Раньше все три варианта обещали карту. */}
              {payFromWallet
                ? "Сумма заморозится на вашем балансе и уйдёт продавцу только после того, как вы подтвердите получение. Если сделка не состоится — деньги вернутся на баланс."
                : holdsOnCard
                  ? "Банк удержит сумму на вашей карте и спишет её только после того, как вы подтвердите получение. Если сделка не состоится — удержание снимается, деньги вернутся на карту."
                  : "Сумма списывается с карты и хранится на счёте платформы. Продавец получит её только после того, как вы подтвердите получение. Если сделка не состоится — банк вернёт деньги на карту."}
            </p>
          </div>
        )}

        <div className="mt-[16px] flex justify-between gap-[8px]">
          <Button
            variant="ghost"
            disabled={busy || step === 1}
            onClick={() => setStep((s) => (s === 3 && !offersCdek ? 1 : s - 1))}
          >
            <ChevronLeft size={16} /> Назад
          </Button>
          {step < 3 ? (
            <Button
              onClick={goNext}
              disabled={busy || quoteLoading || (step === 2 && !destination)}
              className="gap-[6px]"
            >
              {quoteLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <ChevronRight size={16} />
              )}
              Далее
            </Button>
          ) : (
            <Button
              onClick={() => void pay()}
              disabled={busy || !acceptTerms}
              className="gap-[6px]"
            >
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              {holdsOnCard && !payFromWallet ? "Оплатить и захолдировать" : "Оплатить"}
            </Button>
          )}
        </div>
        {step === 3 && (
          <p className="mt-[10px] text-center text-[12px]">
            <a
              href="/rules/safe-deal"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)" }}
            >
              Как работает безопасная сделка
            </a>
          </p>
        )}
      </DialogContent>
    </Dialog>
  );
}

function Row({ label, value, emphasize }: { label: string; value: string; emphasize?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-[12px] text-[13px]">
      <span style={{ color: "var(--foreground-50)" }}>{label}</span>
      <span
        className={emphasize ? "text-[16px] font-bold" : "font-medium"}
        style={{ color: "var(--foreground)" }}
      >
        {value}
      </span>
    </div>
  );
}
