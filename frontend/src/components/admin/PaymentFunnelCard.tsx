import { useEffect, useState } from "react";
import { fetchPaymentFunnel, type PaymentFunnel } from "@/lib/api/admin";
import { reportReadFailure } from "@/lib/errors/handle";

type CardStyle = React.CSSProperties;

/**
 * Воронка оплат: начато → дошло до формы → оплачено, и почему не дошло.
 *
 * ЗАГЛУШКА НЕ СЧИТАЕТСЯ, и об этом сказано прямо на карточке. На 30.09 в
 * боевой базе 39 «оплат» из 46 — это тестовый контур, ставящий «оплачено»
 * без банка. Смешав их с настоящими, воронка показала бы благополучие,
 * которого нет.
 *
 * БРОШЕННАЯ ФОРМА СТОИТ ОТДЕЛЬНО ОТ ОТКАЗА. Это не придирка к словам:
 * банк брошенного платежа не видел, и складывать их значит утверждать,
 * что он отклоняет почти всё.
 */
export function PaymentFunnelCard({ cardStyle }: { cardStyle: CardStyle }) {
  const [period, setPeriod] = useState<{ from: string; to: string }>({ from: "", to: "" });
  const [data, setData] = useState<PaymentFunnel | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchPaymentFunnel(period)
      .then((d) => alive && setData(d))
      .catch((e) => reportReadFailure(e, "воронка оплат"))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [period]);

  const поле: React.CSSProperties = {
    height: 32,
    padding: "0 8px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--background)",
    fontSize: 13,
    color: "var(--foreground)",
  };

  const начато = data?.steps.find((s) => s.key === "started")?.count ?? 0;
  const доля = (n: number) => (начато > 0 ? Math.round((n / начато) * 100) : 0);

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
        Воронка оплат
      </h4>
      <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 6 }}>
        Только настоящие платежи: тестовый контур не считается — он ставит «оплачено» без банка.
        Брошенная форма стоит отдельно от отказа: банк такого платежа не видел.
      </p>

      <div className="mt-3 flex flex-wrap items-end gap-2">
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>С</span>
          <input
            type="date"
            value={period.from}
            onChange={(e) => setPeriod((p) => ({ ...p, from: e.target.value }))}
            style={поле}
          />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>По</span>
          <input
            type="date"
            value={period.to}
            onChange={(e) => setPeriod((p) => ({ ...p, to: e.target.value }))}
            style={поле}
          />
        </label>
        {(period.from || period.to) && (
          <button
            type="button"
            onClick={() => setPeriod({ from: "", to: "" })}
            style={{ ...поле, cursor: "pointer" }}
          >
            За всё время
          </button>
        )}
      </div>

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 12 }}>Загрузка…</p>
      ) : !data ? null : (
        <>
          <div className="mt-4 space-y-2">
            {data.steps.map((s) => (
              <div key={s.key} className="flex items-center gap-3">
                <span
                  className="shrink-0 text-[13px]"
                  style={{ width: 140, color: "var(--foreground-70)" }}
                >
                  {s.label}
                </span>
                <span
                  style={{
                    height: 18,
                    minWidth: 2,
                    width: `${доля(s.count)}%`,
                    background: "var(--accent-fill)",
                    borderRadius: 4,
                  }}
                />
                <span className="text-[13px]" style={{ color: "var(--foreground)" }}>
                  {s.count}
                  {начато > 0 && s.key !== "started" ? ` · ${доля(s.count)}%` : ""}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {data.outcomes.map((o) => (
              <span
                key={o.key}
                className="rounded-[var(--r-pill)] px-[10px] py-[4px] text-[12px]"
                style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}
              >
                {o.label}: <b style={{ color: "var(--foreground)" }}>{o.count}</b>
              </span>
            ))}
          </div>

          {data.reasons.length > 0 && (
            <div className="mt-4">
              <div style={{ fontSize: 13, fontWeight: 600, color: "var(--foreground)" }}>
                Почему отказано
              </div>
              <ul className="mt-2 space-y-1">
                {data.reasons.map((r) => (
                  <li
                    key={r.code ?? "none"}
                    className="flex justify-between text-[13px]"
                    style={{ color: "var(--foreground-70)" }}
                  >
                    <span>{r.label}</span>
                    <b style={{ color: "var(--foreground)" }}>{r.count}</b>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {data.median_seconds_to_failure !== null && (
            <p style={{ fontSize: 12, color: "var(--foreground-50)", marginTop: 12 }}>
              Медиана от создания до отказа: {Math.round(data.median_seconds_to_failure / 60)} мин.
              Считается по времени самого отказа, а не по правке строки — последнее показывало бы
              час работы сверки.
            </p>
          )}
        </>
      )}
    </div>
  );
}
