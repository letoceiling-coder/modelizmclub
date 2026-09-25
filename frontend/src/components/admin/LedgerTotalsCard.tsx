import { useEffect, useState } from "react";
import { fetchAdminLedgerTotals, type AdminLedgerTotals } from "@/lib/api/admin";
import { inputStyle } from "@/components/admin/adminShared";
import { LoadFailed } from "@/components/ui/load-failed";
import { reportReadFailure } from "@/lib/errors/handle";

type CardStyle = React.CSSProperties;

function рубли(kopecks: number): string {
  return (kopecks / 100).toLocaleString("ru-RU", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

/**
 * Четыре числа, ради которых открывают бухгалтерию.
 *
 * Считаются на сервере: списки приходят страницами, и сумма по текущей
 * странице — не итог, а случайное число, похожее на итог.
 *
 * Остаток в кошельках — снимок на сейчас, а не за период, и это сказано
 * прямо: иначе при выбранном периоде его прочтут как «за эти даты».
 */
export function LedgerTotalsCard({ cardStyle }: { cardStyle: CardStyle }) {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [totals, setTotals] = useState<AdminLedgerTotals | null>(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const load = (f: string, t: string) => {
    setLoading(true);
    setFailed(false);
    fetchAdminLedgerTotals({ from: f || undefined, to: t || undefined })
      .then(setTotals)
      .catch((e) => {
        setTotals(null);
        setFailed(true);
        reportReadFailure(e, "итоги по деньгам");
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load("", "");
  }, []);

  const строки: Array<{ подпись: string; сумма: number; пояснение?: string }> = totals
    ? [
        { подпись: "Принято", сумма: totals.received_kopecks, пояснение: "пополнения кошельков" },
        {
          подпись: "Выплачено",
          сумма: totals.paid_out_kopecks,
          пояснение: "продавцам по сделкам и выводы",
        },
        { подпись: "Комиссия", сумма: totals.commission_kopecks, пояснение: "удержано площадкой" },
        {
          подпись: "В кошельках",
          сумма: totals.wallets_balance_kopecks,
          пояснение: "на сейчас, не за период",
        },
        {
          подпись: "В залоге",
          сумма: totals.wallets_held_kopecks,
          пояснение: "принадлежит незакрытым сделкам",
        },
      ]
    : [];

  return (
    <div style={{ ...cardStyle, padding: "20px", marginBottom: "16px" }}>
      <h4 style={{ fontFamily: "var(--font-display)", marginBottom: "12px" }}>Итоги</h4>

      <div
        style={{
          display: "flex",
          gap: 8,
          alignItems: "flex-end",
          flexWrap: "wrap",
          marginBottom: 16,
        }}
      >
        <label style={{ display: "block" }}>
          <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>С</span>
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            style={inputStyle}
          />
        </label>
        <label style={{ display: "block" }}>
          <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>По</span>
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            style={inputStyle}
          />
        </label>
        <button
          type="button"
          onClick={() => load(from, to)}
          style={{
            height: 38,
            padding: "0 14px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: "var(--background-surface)",
            fontSize: 14,
          }}
        >
          Пересчитать
        </button>
        {(from || to) && (
          <button
            type="button"
            onClick={() => {
              setFrom("");
              setTo("");
              load("", "");
            }}
            style={{
              height: 38,
              padding: "0 14px",
              borderRadius: 8,
              border: "1px solid var(--border)",
              background: "transparent",
              fontSize: 14,
              color: "var(--foreground-70)",
            }}
          >
            За всё время
          </button>
        )}
      </div>

      {failed ? (
        <LoadFailed onRetry={() => load(from, to)} />
      ) : loading ? (
        <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>Считаем…</p>
      ) : (
        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          }}
        >
          {строки.map((s) => (
            <div
              key={s.подпись}
              style={{
                padding: "12px",
                borderRadius: 10,
                border: "1px solid var(--border)",
                background: "var(--background-surface)",
              }}
            >
              <div style={{ fontSize: "12px", color: "var(--foreground-50)" }}>{s.подпись}</div>
              <div
                style={{ fontSize: "20px", fontWeight: 700, fontVariantNumeric: "tabular-nums" }}
              >
                {рубли(s.сумма)} ₽
              </div>
              {s.пояснение && (
                <div style={{ fontSize: "11px", color: "var(--foreground-50)", marginTop: 2 }}>
                  {s.пояснение}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
