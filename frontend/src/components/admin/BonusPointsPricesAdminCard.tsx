import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { updateAdminSettings } from "@/lib/api/admin";
import { fetchBonusPoints, type BonusBoostPrice } from "@/lib/api/bonus-points";

type CardStyle = React.CSSProperties;

/**
 * Во что обращаются баллы: цены на размещение и на каждый вариант продвижения.
 *
 * ЦЕНА, А НЕ КУРС. Курс «баллов за рубль» пришлось бы умножать на рублёвую
 * цену, а она зависит от категории и промокода — одно и то же размещение
 * стоило бы разное число баллов, и человек не мог бы заранее понять,
 * хватает ли ему. Поэтому здесь назначается прямое число.
 *
 * ПОДПИСКИ ЗДЕСЬ НЕТ. Не забыли: она месячная, её продают за деньги.
 * Поля под неё нет вовсе, чтобы никто не включил по недосмотру.
 *
 * Список вариантов продвижения приходит с сервера — теми же пакетами, что
 * видит покупатель. Заводить их второй раз здесь значило бы развести
 * списки при первой же правке тарифов.
 */
export function BonusPointsPricesAdminCard({ cardStyle }: { cardStyle: CardStyle }) {
  const [enabled, setEnabled] = useState(true);
  const [placement, setPlacement] = useState(100);
  const [boosts, setBoosts] = useState<BonusBoostPrice[]>([]);
  const [saved, setSaved] = useState<{ enabled: boolean; placement: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    fetchBonusPoints()
      .then((d) => {
        setEnabled(d.enabled);
        setPlacement(d.listing_placement_points || 100);
        setBoosts(d.boosts);
        setSaved({ enabled: d.enabled, placement: d.listing_placement_points });
      })
      .catch(() => toast.error("Не удалось загрузить цены в баллах"))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminSettings([
        {
          key: "bonus_points_prices",
          group: "marketing",
          value: {
            enabled,
            listing_placement: placement,
            boosts: Object.fromEntries(boosts.map((b) => [b.id, b.points])),
          },
        },
      ]);
      toast.success("Цены в баллах сохранены");
      reload();
    } catch {
      toast.error("Не удалось сохранить");
    } finally {
      setSaving(false);
    }
  };

  const inputStyle: React.CSSProperties = {
    height: 36,
    padding: "0 10px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--background)",
    fontSize: 13,
    color: "var(--foreground)",
  };

  return (
    <div style={{ ...cardStyle, padding: 20, marginBottom: 16 }}>
      <h4
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: 16,
          color: "var(--foreground)",
        }}
      >
        Оплата баллами
      </h4>
      <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 6 }}>
        Баллами оплачиваются размещение и продвижение объявлений. Подписка — нет: она месячная, её
        продаём за деньги. Ноль в поле означает «этим баллами платить нельзя», а не «бесплатно».
      </p>

      {saved && (
        <p style={{ fontSize: 12, color: "var(--foreground-50)", marginTop: 8 }}>
          Сейчас действует:{" "}
          {saved.enabled ? `оплата включена · размещение ${saved.placement}` : "оплата выключена"}
        </p>
      )}

      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label
          className="flex items-center gap-2 text-[13px]"
          style={{ color: "var(--foreground-70)" }}
        >
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
          Оплата баллами доступна
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>
            Баллов за размещение объявления
          </span>
          <input
            type="number"
            min={0}
            value={placement}
            onChange={(e) => setPlacement(Math.max(0, +e.target.value))}
            style={{ ...inputStyle, width: 200 }}
          />
        </label>
      </div>

      <div className="mt-4">
        <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
          Варианты продвижения
        </div>
        {loading ? (
          <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : boosts.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>
            Пакетов продвижения пока нет — заводятся в тарифах размещения.
          </p>
        ) : (
          <div className="mt-2 flex flex-wrap gap-3">
            {boosts.map((b) => (
              <label key={b.id} style={{ display: "grid", gap: 4 }}>
                <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>
                  {b.label} · {(b.price_cents / 100).toLocaleString("ru-RU")} ₽
                </span>
                <input
                  type="number"
                  min={0}
                  value={b.points}
                  onChange={(e) =>
                    setBoosts((prev) =>
                      prev.map((x) =>
                        x.id === b.id ? { ...x, points: Math.max(0, +e.target.value) } : x,
                      ),
                    )
                  }
                  style={{ ...inputStyle, width: 140 }}
                />
              </label>
            ))}
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={save}
        disabled={saving}
        className="mt-4"
        style={{
          height: 36,
          padding: "0 16px",
          borderRadius: 8,
          background: "var(--accent-fill)",
          color: "#fff",
          fontWeight: 600,
          fontSize: 13,
        }}
      >
        {saving ? "…" : "Сохранить"}
      </button>
    </div>
  );
}
