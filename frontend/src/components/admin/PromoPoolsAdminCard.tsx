import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import {
  fetchAdminPromoPools,
  createAdminPromoPool,
  pauseAdminPromoPool,
  resumeAdminPromoPool,
  completeAdminPromoPool,
  type AdminPromoPool,
} from "@/lib/api/admin";

type CardStyle = React.CSSProperties;

const YEAR_END_2026 = "2026-12-31T23:59:59";

export function PromoPoolsAdminCard({ cardStyle }: { cardStyle: CardStyle }) {
  const [pools, setPools] = useState<AdminPromoPool[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [seats, setSeats] = useState<number | "custom">(300);
  const [customSeats, setCustomSeats] = useState(300);
  const [term, setTerm] = useState<"year_end" | "months" | "date">("year_end");
  const [months, setMonths] = useState(12);
  const [date, setDate] = useState("2026-12-31");
  const [autoAssign, setAutoAssign] = useState(true);
  const [name, setName] = useState("Первые 300 пользователей — бесплатно до 31.12.2026");

  const reload = () => {
    setLoading(true);
    fetchAdminPromoPools()
      .then(setPools)
      .catch(() => toast.error("Не удалось загрузить промо-пулы"))
      .finally(() => setLoading(false));
  };

  useEffect(reload, []);

  const maxActivations = seats === "custom" ? Math.max(1, customSeats) : seats;

  const expiresAt = (): string => {
    if (term === "year_end") return YEAR_END_2026;
    if (term === "months") {
      const d = new Date();
      d.setMonth(d.getMonth() + Math.max(1, months));
      d.setHours(23, 59, 59, 0);
      return d.toISOString();
    }
    return `${date}T23:59:59`;
  };

  const create = async () => {
    setSaving(true);
    try {
      await createAdminPromoPool({
        name: name.trim() || `Промо-пул на ${maxActivations} мест`,
        max_activations: maxActivations,
        expires_at: expiresAt(),
        auto_assign_on_register: autoAssign,
      });
      toast.success("Промо-пул создан");
      reload();
    } catch {
      toast.error("Не удалось создать пул");
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
  const primaryBtn: React.CSSProperties = {
    height: 36,
    padding: "0 16px",
    borderRadius: 8,
    background: "var(--accent)",
    color: "#fff",
    fontWeight: 600,
    fontSize: 13,
  };
  const ghostBtn: React.CSSProperties = {
    height: 32,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "transparent",
    color: "var(--foreground-70)",
    fontSize: 12,
    fontWeight: 600,
  };

  return (
    <div style={{ ...cardStyle, padding: 20, marginBottom: 16 }}>
      <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--foreground)" }}>
        Промо-пулы и гранты
      </h4>
      <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 6 }}>
        Акция вроде «Первые 300 до 31.12.2026». Пауза и завершение останавливают выдачу новым, уже выданные места не снимаются.
      </p>

      <div className="mt-4 grid gap-3" style={{ border: "1px solid var(--border)", borderRadius: 12, padding: 14 }}>
        <strong style={{ fontSize: 13, color: "var(--foreground)" }}>Создать промо-пул подписок</strong>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>Название</span>
          <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        </label>
        <div className="flex flex-wrap gap-2">
          {([100, 200, 300] as const).map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => {
                setSeats(n);
                setName(`Первые ${n} пользователей — бесплатно до 31.12.2026`);
              }}
              style={{
                ...ghostBtn,
                background: seats === n ? "var(--accent-soft)" : "transparent",
                color: seats === n ? "var(--accent)" : "var(--foreground-70)",
              }}
            >
              {n} мест
            </button>
          ))}
          <button type="button" onClick={() => setSeats("custom")} style={{
            ...ghostBtn,
            background: seats === "custom" ? "var(--accent-soft)" : "transparent",
            color: seats === "custom" ? "var(--accent)" : "var(--foreground-70)",
          }}>
            Произвольное
          </button>
          {seats === "custom" && (
            <input type="number" min={1} value={customSeats} onChange={(e) => setCustomSeats(+e.target.value)} style={{ ...inputStyle, width: 100 }} />
          )}
        </div>
        <div className="flex flex-wrap items-end gap-3">
          <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--foreground-70)" }}>
            <input type="radio" checked={term === "year_end"} onChange={() => setTerm("year_end")} />
            До конца года (31.12.2026)
          </label>
          <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--foreground-70)" }}>
            <input type="radio" checked={term === "months"} onChange={() => setTerm("months")} />
            N месяцев
          </label>
          {term === "months" && (
            <input type="number" min={1} max={60} value={months} onChange={(e) => setMonths(+e.target.value)} style={{ ...inputStyle, width: 80 }} />
          )}
          <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--foreground-70)" }}>
            <input type="radio" checked={term === "date"} onChange={() => setTerm("date")} />
            Дата
          </label>
          {term === "date" && (
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} style={inputStyle} />
          )}
        </div>
        <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--foreground-70)" }}>
          <input type="checkbox" checked={autoAssign} onChange={(e) => setAutoAssign(e.target.checked)} />
          Автоматически выдавать новым зарегистрированным
        </label>
        <button type="button" onClick={create} disabled={saving} style={primaryBtn}>
          {saving ? "Создаём…" : "Создать промо-пул подписок"}
        </button>
      </div>

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : pools.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>Пул ещё не создан.</p>
        ) : (
          <table className="w-full min-w-[640px] text-left text-[13px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--foreground-50)", borderBottom: "1px solid var(--border)" }}>
                <th className="py-2 pr-3 font-medium">Название</th>
                <th className="py-2 pr-3 font-medium">Прогресс</th>
                <th className="py-2 pr-3 font-medium">До</th>
                <th className="py-2 font-medium">Действия</th>
              </tr>
            </thead>
            <tbody>
              {pools.map((p) => (
                <tr key={p.uuid} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2 pr-3" style={{ color: "var(--foreground)" }}>
                    {p.name}
                    {p.completed_at ? (
                      <span style={{ color: "var(--foreground-50)", marginLeft: 6 }}>завершён</span>
                    ) : !p.is_active ? (
                      <span style={{ color: "var(--foreground-50)", marginLeft: 6 }}>пауза</span>
                    ) : null}
                  </td>
                  <td className="py-2 pr-3" style={{ color: "var(--foreground-70)" }}>
                    {p.current_activations} / {p.max_activations} занято
                  </td>
                  <td className="py-2 pr-3" style={{ color: "var(--foreground-50)" }}>
                    {p.expires_at ? new Date(p.expires_at).toLocaleDateString("ru-RU") : "—"}
                  </td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-2">
                      {!p.completed_at && p.is_active && (
                        <button
                          type="button"
                          style={ghostBtn}
                          onClick={() => pauseAdminPromoPool(p.uuid).then(reload).catch(() => toast.error("Не удалось приостановить"))}
                        >
                          Приостановить
                        </button>
                      )}
                      {!p.completed_at && !p.is_active && (
                        <button
                          type="button"
                          style={ghostBtn}
                          onClick={() => resumeAdminPromoPool(p.uuid).then(reload).catch(() => toast.error("Не удалось возобновить"))}
                        >
                          Возобновить
                        </button>
                      )}
                      {!p.completed_at && (
                        <button
                          type="button"
                          style={ghostBtn}
                          onClick={() => completeAdminPromoPool(p.uuid).then(reload).catch(() => toast.error("Не удалось завершить"))}
                        >
                          Завершить
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
