import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { Loader2, MapPin, Check } from "lucide-react";
import { toast } from "@/lib/toast";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { LoadFailed } from "@/components/ui/load-failed";
import { PickupPointsMap } from "@/components/deals/PickupPointsMap";
import { искатьПункты } from "@/lib/delivery/pvz-search";
import { searchCdekCities, fetchCdekPickupPoints } from "@/lib/api/cdek";
import type { CdekCity, CdekPickupPoint } from "@/lib/api/cdek";
import {
  fetchSellerDeliveryProfiles,
  saveSellerCdekPoint,
  type SellerDeliveryProfile,
} from "@/lib/api/seller-delivery";
import { reportActionFailure, reportReadFailure } from "@/lib/errors/handle";

export const Route = createFileRoute("/settings/delivery")({
  component: DeliverySection,
});

/**
 * Откуда продавец отправляет посылки.
 *
 * До 22.09 этого экрана не было, и ручки `users/me/delivery-profile` не
 * звал никто: в таблице лежало ноль строк. Расчёт доставки при этом
 * проходил — СДЭК считает по коду города, — а заказ у перевозчика падал
 * с `[shipment_point] is empty`. Ни одно из девятнадцати отправлений не
 * завелось.
 *
 * Карта и поиск здесь те же, что у покупателя при выборе пункта выдачи:
 * `PickupPointsMap` и `искатьПункты`. Второй такой пары заводить незачем.
 */
function DeliverySection() {
  const [profile, setProfile] = useState<SellerDeliveryProfile | null>(null);
  const [грузится, setГрузится] = useState(true);
  const [ошибкаЧтения, setОшибкаЧтения] = useState(false);

  const [cityQuery, setCityQuery] = useState("");
  const [cities, setCities] = useState<CdekCity[]>([]);
  const [city, setCity] = useState<CdekCity | null>(null);

  const [points, setPoints] = useState<CdekPickupPoint[]>([]);
  const [пунктыГрузятся, setПунктыГрузятся] = useState(false);
  const [pointQuery, setPointQuery] = useState("");
  const [selected, setSelected] = useState<CdekPickupPoint | null>(null);
  const [mapBroken, setMapBroken] = useState(false);
  const [view, setView] = useState<"list" | "map">("list");
  const [сохраняется, setСохраняется] = useState(false);

  useEffect(() => {
    let живо = true;
    fetchSellerDeliveryProfiles()
      .then((rows) => {
        if (!живо) return;
        setProfile(rows.find((r) => r.provider === "cdek" && r.is_default) ?? null);
      })
      .catch((e) => {
        if (!живо) return;
        setОшибкаЧтения(true);
        reportReadFailure(e, "пункт отправки продавца");
      })
      .finally(() => {
        if (живо) setГрузится(false);
      });
    return () => {
      живо = false;
    };
  }, []);

  useEffect(() => {
    const q = cityQuery.trim();
    if (q.length < 2) {
      setCities([]);
      return;
    }
    let живо = true;
    const t = setTimeout(() => {
      searchCdekCities(q)
        .then((rows) => {
          if (живо) setCities(rows);
        })
        .catch((e) => reportReadFailure(e, "города СДЭК"));
    }, 300);
    return () => {
      живо = false;
      clearTimeout(t);
    };
  }, [cityQuery]);

  useEffect(() => {
    if (city === null) {
      setPoints([]);
      return;
    }
    let живо = true;
    setПунктыГрузятся(true);
    fetchCdekPickupPoints(city.code)
      .then((rows) => {
        if (живо) setPoints(rows);
      })
      .catch((e) => {
        if (!живо) return;
        setPoints([]);
        reportReadFailure(e, "пункты СДЭК в городе");
      })
      .finally(() => {
        if (живо) setПунктыГрузятся(false);
      });
    return () => {
      живо = false;
    };
  }, [city]);

  const видимые = useMemo(() => искатьПункты(points, pointQuery), [points, pointQuery]);
  const картаВозможна = !mapBroken && points.some((p) => p.latitude != null && p.longitude != null);

  async function сохранить() {
    if (selected === null || city === null) return;
    setСохраняется(true);
    try {
      const saved = await saveSellerCdekPoint({
        externalPointId: selected.id,
        label: selected.name,
        address: selected.address ?? null,
        cityCode: city.code,
        latitude: selected.latitude ?? null,
        longitude: selected.longitude ?? null,
      });
      setProfile(saved);
      setSelected(null);
      setCity(null);
      setCityQuery("");
      toast.success("Пункт отправки сохранён");
    } catch (e) {
      reportActionFailure(e, "Не удалось сохранить пункт отправки");
    } finally {
      setСохраняется(false);
    }
  }

  if (грузится) {
    return (
      <SettingsSectionShell title="Доставка">
        <div className="flex justify-center py-[32px]">
          <Loader2 className="h-5 w-5 animate-spin" style={{ color: "var(--foreground-50)" }} />
        </div>
      </SettingsSectionShell>
    );
  }

  if (ошибкаЧтения) {
    return (
      <SettingsSectionShell title="Доставка">
        <LoadFailed onRetry={() => window.location.reload()} />
      </SettingsSectionShell>
    );
  }

  return (
    <SettingsSectionShell title="Доставка">
      <Card className="space-y-[12px] p-[16px]">
        <div>
          <h2 className="text-[15px] font-semibold" style={{ color: "var(--foreground)" }}>
            Пункт отправки СДЭК
          </h2>
          <p className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
            Откуда вы сдаёте посылки. Без него доставка СДЭК по вашим объявлениям не оформляется.
          </p>
        </div>

        {profile !== null ? (
          <div
            className="flex items-start gap-[8px] rounded-[var(--r-card)] border p-[12px]"
            style={{ borderColor: "var(--border)", background: "var(--background-surface)" }}
          >
            <Check className="mt-[2px] h-4 w-4 shrink-0" style={{ color: "var(--success)" }} />
            <div className="min-w-0">
              <p className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                {profile.label ?? profile.external_point_id}
              </p>
              <p className="text-[13px]" style={{ color: "var(--foreground-70)" }}>
                {String(profile.address?.address ?? "")}
              </p>
            </div>
          </div>
        ) : (
          <p
            className="rounded-[var(--r-card)] border p-[12px] text-[13px]"
            style={{ borderColor: "var(--warning)", color: "var(--foreground-70)" }}
          >
            Пункт не выбран — покупатели не могут оформить доставку СДЭК по вашим объявлениям.
          </p>
        )}

        <div className="space-y-[6px]">
          <Input
            type="search"
            value={cityQuery}
            onChange={(e) => {
              setCityQuery(e.target.value);
              setCity(null);
              setSelected(null);
            }}
            placeholder="Город — например, Краснодар"
            aria-label="Город отправки"
          />
          {city === null && cities.length > 0 && (
            <div className="space-y-[4px]">
              {cities.slice(0, 8).map((c) => (
                <button
                  key={c.code}
                  type="button"
                  className="block w-full rounded-[var(--r-tag)] border px-[10px] py-[8px] text-left text-[13px]"
                  style={{ borderColor: "var(--border)", color: "var(--foreground)" }}
                  onClick={() => {
                    setCity(c);
                    setCityQuery(c.city);
                  }}
                >
                  {c.city}
                  {c.region != null && c.region !== "" ? `, ${c.region}` : ""}
                </button>
              ))}
            </div>
          )}
        </div>

        {пунктыГрузятся && (
          <div className="flex justify-center py-[16px]">
            <Loader2 className="h-4 w-4 animate-spin" style={{ color: "var(--foreground-50)" }} />
          </div>
        )}

        {city !== null && !пунктыГрузятся && points.length === 0 && (
          <p className="text-[13px]" style={{ color: "var(--foreground-70)" }}>
            В этом городе пунктов СДЭК не нашлось.
          </p>
        )}

        {points.length > 0 && (
          <>
            {картаВозможна && (
              <div className="flex gap-[6px] sm:hidden">
                {(["list", "map"] as const).map((вид) => (
                  <button
                    key={вид}
                    type="button"
                    aria-pressed={view === вид}
                    className="min-h-[36px] flex-1 rounded-[var(--r-tag)] border text-[13px] font-semibold"
                    style={{
                      borderColor: view === вид ? "var(--accent)" : "var(--border)",
                      background:
                        view === вид ? "var(--accent-soft)" : "var(--background-elevated)",
                      color: view === вид ? "var(--accent)" : "var(--foreground-70)",
                    }}
                    onClick={() => setView(вид)}
                  >
                    {вид === "list" ? "Списком" : "На карте"}
                  </button>
                ))}
              </div>
            )}

            {картаВозможна && (
              <PickupPointsMap
                points={видимые}
                selectedId={selected?.id ?? null}
                onSelect={setSelected}
                onUnavailable={() => {
                  setMapBroken(true);
                  setView("list");
                }}
                className={view === "map" ? "" : "hidden sm:block"}
              />
            )}

            <div className={view === "map" ? "hidden sm:block" : "space-y-[6px]"}>
              <Input
                type="search"
                value={pointQuery}
                onChange={(e) => setPointQuery(e.target.value)}
                placeholder="Улица или дом — например, Ленина 12"
                aria-label="Поиск пункта по адресу"
              />
              <p aria-live="polite" className="sr-only">
                {`Найдено пунктов: ${видимые.length}`}
              </p>
              <div className="max-h-[280px] space-y-[4px] overflow-y-auto">
                {видимые.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    aria-pressed={selected?.id === p.id}
                    className="flex w-full items-start gap-[8px] rounded-[var(--r-tag)] border px-[10px] py-[8px] text-left"
                    style={{
                      borderColor: selected?.id === p.id ? "var(--accent)" : "var(--border)",
                      background:
                        selected?.id === p.id ? "var(--accent-soft)" : "var(--background-elevated)",
                    }}
                    onClick={() => setSelected(p)}
                  >
                    <MapPin
                      className="mt-[2px] h-4 w-4 shrink-0"
                      style={{ color: "var(--foreground-50)" }}
                    />
                    <span className="min-w-0">
                      <span
                        className="block text-[13px] font-semibold"
                        style={{ color: "var(--foreground)" }}
                      >
                        {p.name}
                      </span>
                      <span className="block text-[12px]" style={{ color: "var(--foreground-70)" }}>
                        {p.address ?? ""}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </div>

            <Button
              type="button"
              disabled={selected === null || сохраняется}
              onClick={() => void сохранить()}
            >
              {сохраняется ? "Сохраняю…" : "Сохранить пункт отправки"}
            </Button>
          </>
        )}
      </Card>
    </SettingsSectionShell>
  );
}
