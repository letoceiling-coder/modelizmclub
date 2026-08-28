import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Check, ChevronLeft, ChevronRight, Loader2, MapPin, ShieldCheck } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui-bespoke/Checkbox";
import type { Ad } from "@/lib/mock";
import { ApiError } from "@/lib/api/client";
import { fetchCdekPickupPoints, searchCdekCities, type CdekCity, type CdekPickupPoint } from "@/lib/api/cdek";
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

const FEE_PERCENT = 5;

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ad: Ad;
}

function parcelLabel(ad: Ad): string {
  const size = ad.packageSize?.toUpperCase();
  const dims = ad.dimensionsCm;
  const weight = ad.weightKg;
  const parts: string[] = [];
  if (size) parts.push(`Типоразмер ${size}`);
  if (dims?.length && dims.width && dims.height) {
    parts.push(`${dims.length}×${dims.width}×${dims.height} см`);
  }
  if (weight) parts.push(`${weight} кг`);
  return parts.join(" · ") || "Габариты не указаны";
}

export function SafeDealCheckoutWizard({ open, onOpenChange, ad }: Props) {
  const navigate = useNavigate();
  const offersCdek = Boolean(ad.offersCdek || ad.delivery.some((d) => /сдэк|cdek/i.test(d)));
  const itemKopecks = Math.round(ad.price * 100);
  const feeKopecks = Math.round(itemKopecks * FEE_PERCENT / 100);

  const [step, setStep] = useState(1);
  const [cityQuery, setCityQuery] = useState("");
  const [cities, setCities] = useState<CdekCity[]>([]);
  const [cityLoading, setCityLoading] = useState(false);
  const [selectedCity, setSelectedCity] = useState<CdekCity | null>(null);
  const [points, setPoints] = useState<CdekPickupPoint[]>([]);
  const [pointsLoading, setPointsLoading] = useState(false);
  const [selectedPoint, setSelectedPoint] = useState<CdekPickupPoint | null>(null);
  const [quote, setQuote] = useState<SafeDealQuote | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    setStep(1);
    setCityQuery("");
    setCities([]);
    setSelectedCity(null);
    setPoints([]);
    setSelectedPoint(null);
    setQuote(null);
    setAcceptTerms(false);
  }, [open, ad.id]);

  useEffect(() => {
    if (!open || cityQuery.trim().length < 2) {
      setCities([]);
      return;
    }
    let alive = true;
    setCityLoading(true);
    const t = window.setTimeout(() => {
      void searchCdekCities(cityQuery)
        .then((rows) => { if (alive) setCities(rows.slice(0, 8)); })
        .catch(() => { if (alive) setCities([]); })
        .finally(() => { if (alive) setCityLoading(false); });
    }, 280);
    return () => {
      alive = false;
      window.clearTimeout(t);
    };
  }, [cityQuery, open]);

  useEffect(() => {
    if (!selectedCity) {
      setPoints([]);
      return;
    }
    let alive = true;
    setPointsLoading(true);
    void fetchCdekPickupPoints(selectedCity.code)
      .then((rows) => { if (alive) setPoints(rows); })
      .catch(() => { if (alive) setPoints([]); })
      .finally(() => { if (alive) setPointsLoading(false); });
    return () => { alive = false; };
  }, [selectedCity]);

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
      const q = await quoteSafeDeal(ad.id, destination);
      setQuote(q);
    } catch (err) {
      toast.error(firstFieldError((err as ApiError).errors, err instanceof Error ? err.message : "Не удалось рассчитать доставку"));
    } finally {
      setQuoteLoading(false);
    }
  };

  const goNext = () => {
    if (step === 1) {
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
      const deal = await createSafeDeal(ad.id, { acceptTerms, destination });

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
          const checkout = await topupWallet(needRub, window.location.href);
          if (checkout.checkout_url) {
            window.location.href = checkout.checkout_url;
            return;
          }
        } catch {
          void navigate({ to: "/settings/wallet" });
        }
      } else {
        toast.error(firstFieldError((err as ApiError).errors, err instanceof Error ? err.message : "Не удалось создать сделку"));
      }
    } finally {
      setBusy(false);
    }
  };

  const delivery = quote?.delivery_cost_kopecks ?? 0;
  const hold = quote?.hold_kopecks ?? itemKopecks + delivery;
  const mapSrc = selectedPoint?.latitude && selectedPoint?.longitude
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${selectedPoint.longitude - 0.03}%2C${selectedPoint.latitude - 0.02}%2C${selectedPoint.longitude + 0.03}%2C${selectedPoint.latitude + 0.02}&layer=mapnik&marker=${selectedPoint.latitude}%2C${selectedPoint.longitude}`
    : null;

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
          {[1, offersCdek ? 2 : null, 3].filter((s): s is number => s !== null).map((s) => (
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
            <div className="flex gap-[12px] rounded-[var(--r-card)] p-[12px]" style={{ background: "var(--background-surface)" }}>
              {ad.image ? (
                <img src={ad.image} alt="" className="h-[72px] w-[72px] rounded-[10px] object-cover" />
              ) : (
                <div className="h-[72px] w-[72px] rounded-[10px]" style={{ background: "var(--border)" }} />
              )}
              <div className="min-w-0">
                <div className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>{ad.title}</div>
                <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>{ad.city || "Город не указан"}</div>
              </div>
            </div>
            <Row label="Стоимость товара" value={`${ad.price.toLocaleString("ru-RU")} ₽`} />
            <Row label={`Комиссия платформы (${FEE_PERCENT}%)`} value={`${kopecksToRub(feeKopecks)} ₽`} />
            <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              5% удерживается из выплаты продавцу и отображается здесь явно.
            </p>
            <Row label="Габариты и вес" value={parcelLabel(ad)} />
          </div>
        )}

        {step === 2 && offersCdek && (
          <div className="space-y-[12px]">
            <label className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>Город получения</label>
            <Input
              value={cityQuery}
              onChange={(e) => setCityQuery(e.target.value)}
              placeholder="Начните вводить город"
            />
            {cityLoading && <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>Поиск городов…</div>}
            {cities.length > 0 && (
              <div className="flex max-h-[140px] flex-col gap-[4px] overflow-y-auto">
                {cities.map((c) => (
                  <button
                    key={c.code}
                    type="button"
                    className="rounded-[8px] px-[10px] py-[8px] text-left text-[13px]"
                    style={{
                      background: selectedCity?.code === c.code ? "var(--accent-soft)" : "var(--background-surface)",
                      color: "var(--foreground)",
                    }}
                    onClick={() => {
                      setSelectedCity(c);
                      setCityQuery(c.city);
                      setSelectedPoint(null);
                      setQuote(null);
                    }}
                  >
                    {c.city}{c.region ? `, ${c.region}` : ""}
                  </button>
                ))}
              </div>
            )}

            {pointsLoading && (
              <div className="flex items-center gap-[8px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
                <Loader2 size={14} className="animate-spin" /> Загрузка ПВЗ…
              </div>
            )}

            {mapSrc && (
              <iframe
                title="Карта ПВЗ СДЭК"
                src={mapSrc}
                className="h-[180px] w-full rounded-[12px] border-0"
              />
            )}

            <div className="flex max-h-[220px] flex-col gap-[6px] overflow-y-auto">
              {points.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className="flex items-start gap-[8px] rounded-[10px] px-[10px] py-[8px] text-left"
                  style={{
                    border: selectedPoint?.id === p.id ? "1px solid var(--accent)" : "1px solid var(--border)",
                    background: selectedPoint?.id === p.id ? "var(--accent-soft)" : "var(--background-elevated)",
                  }}
                  onClick={() => { setSelectedPoint(p); setQuote(null); }}
                >
                  <MapPin size={14} className="mt-[2px] shrink-0" style={{ color: "var(--accent)" }} />
                  <span className="min-w-0">
                    <span className="block text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>{p.name}</span>
                    <span className="block text-[12px]" style={{ color: "var(--foreground-50)" }}>{p.address}</span>
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
            <Row label={`Комиссия ${FEE_PERCENT}%`} value={`${kopecksToRub(quote?.platform_fee_kopecks ?? feeKopecks)} ₽`} />
            <Row label="Доставка СДЭК" value={offersCdek ? `${kopecksToRub(delivery)} ₽` : "по договорённости"} />
            <Row label="К оплате (холд)" value={`${kopecksToRub(hold)} ₽`} emphasize />
            {selectedPoint && (
              <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                ПВЗ: {selectedPoint.name}{selectedPoint.address ? ` · ${selectedPoint.address}` : ""}
              </p>
            )}
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
            <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              Банк удержит сумму на вашей карте и спишет её только после того, как вы подтвердите
              получение. Если сделка не состоится — удержание снимается, деньги вернутся на карту.
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
            <Button onClick={goNext} disabled={busy || quoteLoading || (step === 2 && !destination)} className="gap-[6px]">
              {quoteLoading ? <Loader2 size={16} className="animate-spin" /> : <ChevronRight size={16} />}
              Далее
            </Button>
          ) : (
            <Button onClick={() => void pay()} disabled={busy || !acceptTerms} className="gap-[6px]">
              {busy ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
              Оплатить и захолдировать
            </Button>
          )}
        </div>
        {step === 3 && (
          <p className="mt-[10px] text-center text-[12px]">
            <a href="/rules/safe-deal" target="_blank" rel="noreferrer" style={{ color: "var(--accent)" }}>
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
      <span className={emphasize ? "text-[16px] font-bold" : "font-medium"} style={{ color: "var(--foreground)" }}>{value}</span>
    </div>
  );
}
