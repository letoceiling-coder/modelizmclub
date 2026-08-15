import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  downloadAdminPaymentsExport,
  fetchAdminPayments,
  type AdminPaymentRow,
  type AdminPaymentStatus,
  type AdminPaymentType,
} from "@/lib/api/admin";

type CardStyle = React.CSSProperties;

const STATUS_LABELS: Record<AdminPaymentStatus, string> = {
  pending: "Ожидает",
  paid: "Оплачен",
  failed: "Ошибка",
  cancelled: "Отменён",
};

function formatMoney(rub: number): string {
  return new Intl.NumberFormat("ru-RU", {
    style: "currency",
    currency: "RUB",
    maximumFractionDigits: 2,
  }).format(rub);
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function AdminPaymentsAdminCard({ cardStyle }: { cardStyle: CardStyle }) {
  const [rows, setRows] = useState<AdminPaymentRow[]>([]);
  const [typeLabels, setTypeLabels] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [page, setPage] = useState(1);
  const [lastPage, setLastPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [type, setType] = useState("");
  const [status, setStatus] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    fetchAdminPayments({
      page,
      per_page: 30,
      ...(type ? { type } : {}),
      ...(status ? { status } : {}),
      ...(from ? { from } : {}),
      ...(to ? { to } : {}),
    })
      .then(({ data, meta, filters }) => {
        setRows(data);
        setLastPage(meta.last_page);
        setTotal(meta.total);
        setTypeLabels(filters.types);
      })
      .catch(() => toast.error("Не удалось загрузить платежи"))
      .finally(() => setLoading(false));
  }, [page, type, status, from, to]);

  useEffect(() => {
    reload();
  }, [reload]);

  const onExport = async () => {
    setExporting(true);
    try {
      await downloadAdminPaymentsExport({
        ...(type ? { type: type as AdminPaymentType } : {}),
        ...(status ? { status: status as AdminPaymentStatus } : {}),
        ...(from ? { from } : {}),
        ...(to ? { to } : {}),
      });
      toast.success("CSV выгружен");
    } catch {
      toast.error("Не удалось выгрузить CSV");
    } finally {
      setExporting(false);
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
    display: "inline-flex",
    alignItems: "center",
    gap: 8,
  };

  const ghostBtn: React.CSSProperties = {
    height: 36,
    padding: "0 12px",
    borderRadius: 8,
    border: "1px solid var(--border)",
    background: "var(--background)",
    fontSize: 13,
    color: "var(--foreground-70)",
  };

  return (
    <div style={{ ...cardStyle, padding: 20, marginBottom: 16 }}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--foreground)" }}>
            Платежи для бухгалтерии
          </h4>
          <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 6 }}>
            Реестр оплат с типами для выгрузки в 1С (CSV, UTF-8, разделитель «;»).
          </p>
        </div>
        <button type="button" onClick={onExport} disabled={exporting} style={primaryBtn}>
          {exporting ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
          {exporting ? "Выгрузка…" : "CSV"}
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>Тип</span>
          <select
            value={type}
            onChange={(e) => { setType(e.target.value); setPage(1); }}
            style={{ ...inputStyle, minWidth: 180 }}
          >
            <option value="">Все типы</option>
            {Object.entries(typeLabels).map(([key, label]) => (
              <option key={key} value={key}>{label}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>Статус</span>
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            style={{ ...inputStyle, minWidth: 140 }}
          >
            <option value="">Все статусы</option>
            {(Object.keys(STATUS_LABELS) as AdminPaymentStatus[]).map((key) => (
              <option key={key} value={key}>{STATUS_LABELS[key]}</option>
            ))}
          </select>
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>С</span>
          <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} style={inputStyle} />
        </label>
        <label style={{ display: "grid", gap: 4 }}>
          <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>По</span>
          <input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} style={inputStyle} />
        </label>
      </div>

      <div className="mt-4 overflow-x-auto">
        {loading ? (
          <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : rows.length === 0 ? (
          <p style={{ fontSize: 13, color: "var(--foreground-50)" }}>Платежей не найдено.</p>
        ) : (
          <table className="w-full min-w-[920px] text-left text-[13px]" style={{ borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ color: "var(--foreground-50)", borderBottom: "1px solid var(--border)" }}>
                <th className="py-2 pr-3 font-medium">Дата</th>
                <th className="py-2 pr-3 font-medium">Email</th>
                <th className="py-2 pr-3 font-medium">Сумма</th>
                <th className="py-2 pr-3 font-medium">Тип</th>
                <th className="py-2 pr-3 font-medium">Статус</th>
                <th className="py-2 font-medium">Провайдер</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.uuid} style={{ borderBottom: "1px solid var(--border)" }}>
                  <td className="py-2 pr-3 whitespace-nowrap" style={{ color: "var(--foreground-70)" }}>
                    {formatDate(row.paid_at ?? row.created_at)}
                  </td>
                  <td className="py-2 pr-3" style={{ color: "var(--foreground)" }}>{row.user_email ?? "—"}</td>
                  <td className="py-2 pr-3 whitespace-nowrap" style={{ color: "var(--foreground)" }}>
                    {formatMoney(row.amount_rub)}
                  </td>
                  <td className="py-2 pr-3" style={{ color: "var(--foreground-70)" }}>{row.type_label}</td>
                  <td className="py-2 pr-3" style={{ color: "var(--foreground-70)" }}>
                    {STATUS_LABELS[row.status] ?? row.status}
                  </td>
                  <td className="py-2" style={{ color: "var(--foreground-50)" }}>{row.provider ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {!loading && total > 0 && (
        <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
          <span style={{ fontSize: 12, color: "var(--foreground-50)" }}>Всего: {total}</span>
          <div className="flex items-center gap-2">
            <button type="button" style={ghostBtn} disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))}>
              Назад
            </button>
            <span style={{ fontSize: 12, color: "var(--foreground-50)" }}>{page} / {lastPage}</span>
            <button type="button" style={ghostBtn} disabled={page >= lastPage} onClick={() => setPage((p) => p + 1)}>
              Далее
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
