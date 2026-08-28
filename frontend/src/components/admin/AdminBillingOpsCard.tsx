import { useCallback, useEffect, useState } from "react";
import { Download, Loader2 } from "lucide-react";
import { toast } from "@/lib/toast";
import {
  adminRefundSafeDeal,
  adminReleaseSafeDeal,
  downloadAdminSafeDealsExport,
  fetchAdminDisputes,
  fetchAdminSafeDeals,
  fetchAdminWallets,
  fetchAdminWithdrawals,
  resolveAdminDispute,
  updateAdminWithdrawal,
  type AdminDisputeRow,
  type AdminSafeDealRow,
  type AdminWalletRow,
  type AdminWithdrawalRow,
} from "@/lib/api/admin";

type CardStyle = React.CSSProperties;

function rub(kopecks: number): string {
  return (kopecks / 100).toLocaleString("ru-RU", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

function fmt(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("ru-RU", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" });
}

const th: React.CSSProperties = { textAlign: "left", padding: "8px 10px", fontSize: 12, color: "var(--foreground-50)", fontWeight: 600 };
const td: React.CSSProperties = { padding: "8px 10px", fontSize: 13, color: "var(--foreground)", borderTop: "1px solid var(--border)" };
const ghostBtn: React.CSSProperties = {
  height: 32,
  padding: "0 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  background: "transparent",
  fontSize: 12,
  fontWeight: 600,
  color: "var(--foreground)",
  cursor: "pointer",
};

export function AdminBillingOpsCard({ cardStyle }: { cardStyle: CardStyle }) {
  return (
    <div style={{ display: "grid", gap: 16 }}>
      <WalletsBlock cardStyle={cardStyle} />
      <WithdrawalsBlock cardStyle={cardStyle} />
      <DealsBlock cardStyle={cardStyle} />
      <DisputesBlock cardStyle={cardStyle} />
    </div>
  );
}

function WalletsBlock({ cardStyle }: { cardStyle: CardStyle }) {
  const [rows, setRows] = useState<AdminWalletRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const reload = useCallback(() => {
    setLoading(true);
    fetchAdminWallets({ search: search || undefined, page: 1 })
      .then((r) => setRows(r.data))
      .catch(() => toast.error("Не удалось загрузить кошельки"))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => { reload(); }, [reload]);

  return (
    <div style={{ ...cardStyle, padding: 20 }}>
      <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--foreground)" }}>Кошельки</h4>
      <input
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Поиск по имени / email"
        className="outline-none"
        style={{ marginTop: 12, height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--background)", width: "min(320px, 100%)", fontSize: 13, color: "var(--foreground)" }}
      />
      {loading ? <Loader2 size={16} className="mt-3 animate-spin" /> : (
        <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Пользователь</th>
              <th style={th}>Баланс</th>
              <th style={th}>Холд</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={3} style={td}>Нет кошельков</td></tr>}
            {rows.map((w) => (
              <tr key={w.user.uuid ?? w.user.email ?? Math.random()}>
                <td style={td}>{w.user.name ?? "—"}<div style={{ fontSize: 11, color: "var(--foreground-50)" }}>{w.user.email}</div></td>
                <td style={td}>{rub(w.balance_kopecks)} ₽</td>
                <td style={td}>{rub(w.held_kopecks)} ₽</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function WithdrawalsBlock({ cardStyle }: { cardStyle: CardStyle }) {
  const [rows, setRows] = useState<AdminWithdrawalRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetchAdminWithdrawals({ page: 1 })
      .then((r) => setRows(r.data))
      .catch(() => toast.error("Не удалось загрузить заявки на вывод"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const act = async (uuid: string, status: "paid" | "rejected") => {
    setBusy(uuid);
    try {
      await updateAdminWithdrawal(uuid, status);
      toast.success(status === "paid" ? "Вывод подтверждён" : "Заявка отклонена, баланс возвращён");
      reload();
    } catch {
      toast.error("Не удалось обновить заявку");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ ...cardStyle, padding: 20 }}>
      <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--foreground)" }}>Выводы средств</h4>
      {loading ? <Loader2 size={16} className="mt-3 animate-spin" /> : (
        <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Пользователь</th>
              <th style={th}>Сумма</th>
              <th style={th}>Реквизиты</th>
              <th style={th}>Статус</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} style={td}>Нет заявок</td></tr>}
            {rows.map((w) => (
              <tr key={w.uuid}>
                <td style={td}>{w.user.name ?? "—"}</td>
                <td style={td}>{rub(w.amount_kopecks)} ₽</td>
                <td style={td}><span style={{ fontSize: 12 }}>{w.method}: {w.destination}</span></td>
                <td style={td}>{w.status}</td>
                <td style={td}>
                  {w.status === "pending" || w.status === "processing" ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" disabled={busy === w.uuid} style={ghostBtn} onClick={() => void act(w.uuid, "paid")}>Выплачено</button>
                      <button type="button" disabled={busy === w.uuid} style={{ ...ghostBtn, color: "var(--danger)" }} onClick={() => void act(w.uuid, "rejected")}>Отклонить</button>
                    </div>
                  ) : <span style={{ fontSize: 12, color: "var(--foreground-50)" }}>{fmt(w.created_at)}</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

const DEAL_STATUSES: { value: string; label: string }[] = [
  { value: "", label: "Все" },
  { value: "paid", label: "Активные" },
  { value: "shipped", label: "Отправлены" },
  { value: "delivered", label: "Доставлены" },
  { value: "completed", label: "Завершены" },
  { value: "disputed", label: "Споры" },
  { value: "refunded", label: "Возвращены" },
  { value: "cancelled", label: "Отменены" },
];

function DealsBlock({ cardStyle }: { cardStyle: CardStyle }) {
  const [rows, setRows] = useState<AdminSafeDealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [status, setStatus] = useState("");
  const [search, setSearch] = useState("");
  const [exporting, setExporting] = useState(false);

  const filters = { status: status || undefined, search: search.trim() || undefined };

  const reload = useCallback(() => {
    setLoading(true);
    fetchAdminSafeDeals({ status: status || undefined, search: search.trim() || undefined, page: 1 })
      .then((r) => setRows(r.data))
      .catch(() => toast.error("Не удалось загрузить сделки"))
      .finally(() => setLoading(false));
  }, [status, search]);

  useEffect(() => { reload(); }, [reload]);

  const exportCsv = async () => {
    setExporting(true);
    try {
      await downloadAdminSafeDealsExport(filters);
    } catch {
      toast.error("Не удалось выгрузить реестр сделок");
    } finally {
      setExporting(false);
    }
  };

  const act = async (uuid: string, kind: "release" | "refund") => {
    setBusy(uuid);
    try {
      if (kind === "release") await adminReleaseSafeDeal(uuid);
      else await adminRefundSafeDeal(uuid);
      toast.success(kind === "release" ? "Средства переведены продавцу" : "Средства возвращены покупателю");
      reload();
    } catch {
      toast.error("Не удалось выполнить действие");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ ...cardStyle, padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, flexWrap: "wrap" }}>
        <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--foreground)" }}>Безопасные сделки</h4>
        <button type="button" disabled={exporting} style={ghostBtn} onClick={() => void exportCsv()}>
          <Download size={13} style={{ display: "inline", marginRight: 6, verticalAlign: "-2px" }} />
          {exporting ? "Готовим CSV…" : "Выгрузить CSV"}
        </button>
      </div>
      <div style={{ display: "flex", gap: 8, marginTop: 12, flexWrap: "wrap" }}>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="outline-none"
          style={{ height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--background)", fontSize: 13, color: "var(--foreground)" }}
        >
          {DEAL_STATUSES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="UUID, трек-номер, email"
          className="outline-none"
          style={{ height: 36, padding: "0 10px", borderRadius: 8, border: "1px solid var(--border)", background: "var(--background)", width: "min(320px, 100%)", fontSize: 13, color: "var(--foreground)" }}
        />
      </div>
      {loading ? <Loader2 size={16} className="mt-3 animate-spin" /> : (
        <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Сумма</th>
              <th style={th}>Покупатель</th>
              <th style={th}>Продавец</th>
              <th style={th}>Статус</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={5} style={td}>Нет сделок</td></tr>}
            {rows.map((d) => (
              <tr key={d.uuid}>
                <td style={td}>{rub(d.amount_kopecks)} ₽</td>
                <td style={td}>{d.buyer?.name ?? "—"}</td>
                <td style={td}>{d.seller?.name ?? "—"}</td>
                <td style={td}>{d.status_label}</td>
                <td style={td}>
                  {(d.status === "paid" || d.status === "shipped" || d.status === "delivered") && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" disabled={busy === d.uuid} style={ghostBtn} onClick={() => void act(d.uuid, "release")}>Выплатить</button>
                      <button type="button" disabled={busy === d.uuid} style={{ ...ghostBtn, color: "var(--danger)" }} onClick={() => void act(d.uuid, "refund")}>Вернуть</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

function DisputesBlock({ cardStyle }: { cardStyle: CardStyle }) {
  const [rows, setRows] = useState<AdminDisputeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);

  const reload = useCallback(() => {
    setLoading(true);
    fetchAdminDisputes({ page: 1 })
      .then((r) => setRows(r.data))
      .catch(() => toast.error("Не удалось загрузить споры"))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { reload(); }, [reload]);

  const act = async (uuid: string, side: "buyer" | "seller") => {
    setBusy(uuid);
    try {
      await resolveAdminDispute(uuid, side);
      toast.success(side === "buyer" ? "Спор закрыт в пользу покупателя" : "Спор закрыт в пользу продавца");
      reload();
    } catch {
      toast.error("Не удалось разрешить спор");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div style={{ ...cardStyle, padding: 20 }}>
      <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--foreground)" }}>Споры</h4>
      {loading ? <Loader2 size={16} className="mt-3 animate-spin" /> : (
        <table style={{ width: "100%", marginTop: 12, borderCollapse: "collapse" }}>
          <thead>
            <tr>
              <th style={th}>Причина</th>
              <th style={th}>Сумма</th>
              <th style={th}>Открыл</th>
              <th style={th} />
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && <tr><td colSpan={4} style={td}>Открытых споров нет</td></tr>}
            {rows.map((d) => (
              <tr key={d.uuid}>
                <td style={td}>{d.reason}<div style={{ fontSize: 11, color: "var(--foreground-50)" }}>{fmt(d.created_at)}</div></td>
                <td style={td}>{rub(d.deal.amount_kopecks)} ₽</td>
                <td style={td}>{d.opened_by.name ?? "—"}</td>
                <td style={td}>
                  {d.status === "open" && (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button type="button" disabled={busy === d.uuid} style={ghostBtn} onClick={() => void act(d.uuid, "buyer")}>Покупателю</button>
                      <button type="button" disabled={busy === d.uuid} style={ghostBtn} onClick={() => void act(d.uuid, "seller")}>Продавцу</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
