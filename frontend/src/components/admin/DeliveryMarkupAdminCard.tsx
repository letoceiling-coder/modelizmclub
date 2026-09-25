import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { fetchAdminSettings, updateAdminSettings } from "@/lib/api/admin";
import { inputStyle, primaryBtn } from "@/components/admin/adminShared";
import { reportActionFailure, reportReadFailure } from "@/lib/errors/handle";

type CardStyle = React.CSSProperties;

/**
 * Надбавка площадки к тарифу перевозчика.
 *
 * Жила в общем списке настроек — среди сорока строк «ключ: значение», где
 * её находили поиском по странице. Здесь она рядом с остальными числами,
 * которые владелец меняет осознанно: ценой размещения, тарифами подписки,
 * комиссией сделки.
 *
 * Процент и сумма складываются: 5% и 50 ₽ на тарифе 400 ₽ дадут 470 ₽.
 * Покупатель видит одну строку «Доставка» с итогом — разбивка ему ничего
 * не даёт, торговаться с перевозчиком он не может.
 */
export function DeliveryMarkupAdminCard({ cardStyle }: { cardStyle: CardStyle }) {
  const [enabled, setEnabled] = useState(false);
  const [percent, setPercent] = useState(0);
  const [fixedRub, setFixedRub] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAdminSettings()
      .then((rows) => {
        if (!active) return;
        const val = (key: string) =>
          rows.find((r) => r.key === key)?.value as Record<string, unknown> | undefined;
        setEnabled(Boolean(val("delivery.markup.enabled")?.enabled));
        setPercent(Number(val("delivery.markup.percent")?.percent ?? 0));
        setFixedRub(Math.round(Number(val("delivery.markup.fixed_cents")?.fixed_cents ?? 0) / 100));
      })
      .catch((e) => reportReadFailure(e, "надбавка к доставке"))
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminSettings([
        { key: "delivery.markup.enabled", value: { enabled }, group: "delivery" },
        { key: "delivery.markup.percent", value: { percent }, group: "delivery" },
        {
          key: "delivery.markup.fixed_cents",
          value: { fixed_cents: Math.round(fixedRub * 100) },
          group: "delivery",
        },
      ]);
      toast.success("Надбавка сохранена");
    } catch (e) {
      reportActionFailure(e, "Не удалось сохранить надбавку");
    } finally {
      setSaving(false);
    }
  };

  /* Пример на живых числах: «5% и 50 ₽» абстрактно, «400 → 470» — нет. */
  const пример = Math.round(40000 * (1 + percent / 100) + fixedRub * 100) / 100;

  return (
    <div style={{ ...cardStyle, padding: "20px", marginBottom: "16px" }}>
      <h4 style={{ fontFamily: "var(--font-display)", marginBottom: "4px" }}>
        Надбавка к доставке
      </h4>
      <p style={{ fontSize: "13px", color: "var(--foreground-70)", marginBottom: "12px" }}>
        Прибавляется к тарифу перевозчика. Покупатель видит одну сумму без разбивки; владелец видит
        размер надбавки в карточке сделки, изменение попадает в журнал действий.
      </p>

      {loading ? (
        <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>Загружаем…</p>
      ) : (
        <>
          <label style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <input
              type="checkbox"
              checked={enabled}
              onChange={(e) => setEnabled(e.target.checked)}
            />
            <span style={{ fontSize: "14px" }}>Надбавка включена</span>
          </label>

          <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr", maxWidth: 420 }}>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>Процент</span>
              <input
                type="number"
                min={0}
                max={100}
                step={0.5}
                value={percent}
                onChange={(e) => setPercent(Number(e.target.value))}
                style={inputStyle}
                disabled={!enabled}
              />
            </label>
            <label style={{ display: "block" }}>
              <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>Сумма, ₽</span>
              <input
                type="number"
                min={0}
                step={1}
                value={fixedRub}
                onChange={(e) => setFixedRub(Number(e.target.value))}
                style={inputStyle}
                disabled={!enabled}
              />
            </label>
          </div>

          <p style={{ fontSize: "13px", color: "var(--foreground-70)", marginTop: 10 }}>
            {enabled
              ? `Тариф 400 ₽ превратится в ${пример.toLocaleString("ru-RU")} ₽.`
              : "Выключено — покупатель платит тариф перевозчика без прибавки."}
          </p>

          <button
            onClick={() => void save()}
            style={{ ...primaryBtn, marginTop: "12px" }}
            disabled={saving}
          >
            {saving ? "Сохраняем…" : "Сохранить"}
          </button>
        </>
      )}
    </div>
  );
}
