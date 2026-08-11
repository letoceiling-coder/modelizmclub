import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { HandCoins, AlertCircle, BarChart3, Snowflake, Wallet } from "lucide-react";
import { toast } from "@/lib/toast";
import { StatusBadge } from "@/components/StatusBadge";
import {
  adminEscrowAction,
  fetchAdminEscrowDeal,
  fetchAdminEscrowDeals,
  fetchAdminEscrowStats,
  updateAdminEscrowNote,
  type AdminEscrowDealRow,
  type AdminEscrowStats,
} from "@/lib/api/admin-escrow";
import { EscrowFeeSettingsCard } from "@/components/admin/EscrowFeeSettingsCard";

const card = {
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card)",
};

const inputStyle: React.CSSProperties = {
  height: "40px",
  background: "var(--background-elevated)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-input)",
  padding: "0 14px",
  fontSize: "13px",
  color: "var(--foreground)",
};

const primaryBtn: React.CSSProperties = {
  background: "var(--accent)",
  color: "var(--accent-foreground)",
  fontWeight: 600,
  fontSize: "13px",
  borderRadius: "var(--r-button)",
  padding: "0 16px",
  height: "40px",
};

const ESCROW_STATUS_VARIANT: Record<string, "default" | "info" | "success" | "warning" | "danger"> = {
  pending_payment: "default",
  funded: "info",
  paid: "info",
  awaiting_shipment: "warning",
  in_transit: "info",
  delivered: "info",
  awaiting_buyer_confirm: "warning",
  captured: "success",
  payout_pending: "warning",
  completed: "success",
  dispute_open: "danger",
  frozen: "danger",
  refunding: "warning",
  refunded: "default",
  reversed: "default",
  cancelled: "default",
  failed: "danger",
};

function rub(cents: number): string {
  return `${Math.round(cents / 100).toLocaleString("ru-RU")} ₽`;
}

export function EscrowAdminSection() {
  const { t } = useTranslation();
  const statusLabels = useMemo(
    () =>
      ({
        pending_payment: t("pages.adminEscrow.status.pending_payment"),
        funded: t("pages.adminEscrow.status.funded"),
        paid: t("pages.adminEscrow.status.paid"),
        awaiting_shipment: t("pages.adminEscrow.status.awaiting_shipment"),
        in_transit: t("pages.adminEscrow.status.in_transit"),
        delivered: t("pages.adminEscrow.status.delivered"),
        awaiting_buyer_confirm: t("pages.adminEscrow.status.awaiting_buyer_confirm"),
        captured: t("pages.adminEscrow.status.captured"),
        payout_pending: t("pages.adminEscrow.status.payout_pending"),
        completed: t("pages.adminEscrow.status.completed"),
        dispute_open: t("pages.adminEscrow.status.dispute_open"),
        frozen: t("pages.adminEscrow.status.frozen"),
        refunding: t("pages.adminEscrow.status.refunding"),
        refunded: t("pages.adminEscrow.status.refunded"),
        reversed: t("pages.adminEscrow.status.reversed"),
        cancelled: t("pages.adminEscrow.status.cancelled"),
        failed: t("pages.adminEscrow.status.failed"),
      }) as Record<string, string>,
    [t],
  );

  const [stats, setStats] = useState<AdminEscrowStats | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<AdminEscrowDealRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminEscrowDealRow | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [actionReason, setActionReason] = useState("");
  const [partialAmount, setPartialAmount] = useState("");
  const [resolveOutcome, setResolveOutcome] = useState<"buyer" | "seller" | "split">("buyer");
  const [buyerSplitAmount, setBuyerSplitAmount] = useState("");
  const [sellerSplitAmount, setSellerSplitAmount] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAdminEscrowStats()
      .then((d) => active && setStats(d))
      .catch(() => active && toast.error(t("pages.adminEscrow.loadStatsFailed")));
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminEscrowDeals({ status: statusFilter, q: search.trim() || undefined })
      .then((list) => active && setRows(list))
      .catch(() => active && toast.error(t("pages.adminEscrow.loadDealsFailed")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [statusFilter, search, t]);

  const openRow = async (row: AdminEscrowDealRow) => {
    try {
      const full = await fetchAdminEscrowDeal(row.uuid);
      setSelected(full);
      setNoteDraft(full.admin_note ?? "");
      setActionReason("");
      setPartialAmount("");
      setResolveOutcome("buyer");
      setBuyerSplitAmount("");
      setSellerSplitAmount("");
    } catch {
      toast.error(t("pages.adminEscrow.loadDealFailed"));
    }
  };

  const refreshSelected = async (uuid: string) => {
    const full = await fetchAdminEscrowDeal(uuid);
    setSelected(full);
    setRows((list) => list.map((r) => (r.uuid === uuid ? { ...r, ...full } : r)));
  };

  const runResolveDispute = async () => {
    if (!selected) return;
    const note = actionReason.trim();
    if (note.length < 10) {
      toast.error(t("pages.adminEscrow.reasonRequired"));
      return;
    }
    const body: Record<string, unknown> = { outcome: resolveOutcome, note };
    if (resolveOutcome === "split") {
      const buyerCents = buyerSplitAmount
        ? Math.round(parseFloat(buyerSplitAmount.replace(",", ".")) * 100)
        : null;
      const sellerCents = sellerSplitAmount
        ? Math.round(parseFloat(sellerSplitAmount.replace(",", ".")) * 100)
        : null;
      if (buyerCents != null) body.buyer_amount_cents = buyerCents;
      if (sellerCents != null) body.seller_amount_cents = sellerCents;
    }
    setBusy(true);
    try {
      await adminEscrowAction(selected.uuid, "resolve-dispute", body);
      toast.success(t("pages.adminEscrow.actionOk"));
      await refreshSelected(selected.uuid);
      const list = await fetchAdminEscrowDeals({ status: statusFilter, q: search.trim() || undefined });
      setRows(list);
      fetchAdminEscrowStats().then(setStats).catch(() => {});
    } catch {
      toast.error(t("pages.adminEscrow.actionFailed"));
    } finally {
      setBusy(false);
    }
  };

  const runAction = async (
    action: Parameters<typeof adminEscrowAction>[1],
    extra: Record<string, unknown> = {},
  ) => {
    if (!selected) return;
    const reason = actionReason.trim();
    if (reason.length < 10) {
      toast.error(t("pages.adminEscrow.reasonRequired"));
      return;
    }
    setBusy(true);
    try {
      await adminEscrowAction(selected.uuid, action, { reason, ...extra });
      toast.success(t("pages.adminEscrow.actionOk"));
      await refreshSelected(selected.uuid);
      const list = await fetchAdminEscrowDeals({ status: statusFilter, q: search.trim() || undefined });
      setRows(list);
      fetchAdminEscrowStats().then(setStats).catch(() => {});
    } catch {
      toast.error(t("pages.adminEscrow.actionFailed"));
    } finally {
      setBusy(false);
    }
  };

  const saveNote = async () => {
    if (!selected) return;
    setBusy(true);
    try {
      const updated = await updateAdminEscrowNote(selected.uuid, noteDraft.trim() || null);
      setSelected(updated);
      toast.success(t("pages.adminEscrow.noteSaved"));
    } catch {
      toast.error(t("pages.adminEscrow.noteSaveFailed"));
    } finally {
      setBusy(false);
    }
  };

  const statCards = useMemo(
    () => [
      { v: String(stats?.deals_active ?? 0), l: t("pages.adminEscrow.statActive"), icon: HandCoins },
      { v: rub(stats?.on_hold_cents ?? 0), l: t("pages.adminEscrow.statOnHold"), icon: Wallet },
      { v: String(stats?.payout_pending ?? 0), l: t("pages.adminEscrow.statPayoutPending"), icon: BarChart3 },
      {
        v: String(stats?.disputes_open ?? 0),
        l: t("pages.adminEscrow.statDisputes"),
        icon: AlertCircle,
        warn: (stats?.disputes_open ?? 0) > 0,
      },
    ],
    [stats, t],
  );

  const partialCents = partialAmount ? Math.round(parseFloat(partialAmount.replace(",", ".")) * 100) : null;

  return (
    <div>
      <h2 style={{ fontSize: "20px", fontWeight: 700, color: "var(--foreground)", marginBottom: "16px" }}>
        {t("pages.adminEscrow.title")}
      </h2>

      <div className="grid grid-cols-2 lg:grid-cols-4" style={{ gap: "12px", marginBottom: "16px" }}>
        {statCards.map((s) => (
          <div key={s.l} style={{ ...card, padding: "16px" }}>
            <div className="flex items-center gap-2" style={{ color: s.warn ? "var(--danger)" : "var(--foreground-50)" }}>
              <s.icon size={16} />
              <span style={{ fontSize: "12px" }}>{s.l}</span>
            </div>
            <div style={{ fontSize: "22px", fontWeight: 700, marginTop: "8px", color: "var(--foreground)" }}>{s.v}</div>
          </div>
        ))}
      </div>

      <EscrowFeeSettingsCard />

      <div style={{ ...card, padding: "16px", marginTop: "16px" }}>
        <div className="flex flex-wrap gap-3" style={{ marginBottom: "16px" }}>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} style={inputStyle}>
            <option value="all">{t("pages.adminEscrow.filterAll")}</option>
            {Object.keys(statusLabels).map((k) => (
              <option key={k} value={k}>
                {statusLabels[k]}
              </option>
            ))}
          </select>
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("pages.adminEscrow.searchPlaceholder")}
            style={{ ...inputStyle, minWidth: "220px", flex: 1 }}
          />
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid var(--border)", color: "var(--foreground-50)", textAlign: "left" }}>
                <th style={{ padding: "8px" }}>{t("pages.adminEscrow.colListing")}</th>
                <th style={{ padding: "8px" }}>{t("pages.adminEscrow.colBuyer")}</th>
                <th style={{ padding: "8px" }}>{t("pages.adminEscrow.colSeller")}</th>
                <th style={{ padding: "8px" }}>{t("pages.adminEscrow.colAmount")}</th>
                <th style={{ padding: "8px" }}>{t("pages.adminEscrow.colStatus")}</th>
                <th style={{ padding: "8px" }}>{t("pages.adminEscrow.colDelivery")}</th>
                <th style={{ padding: "8px" }} />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "24px", color: "var(--foreground-50)" }}>
                    {t("pages.adminCommon.loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "24px", color: "var(--foreground-50)" }}>
                    {t("pages.adminEscrow.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.uuid} style={{ borderBottom: "1px solid var(--border)" }}>
                    <td style={{ padding: "8px", maxWidth: "180px" }}>{row.listing?.title ?? "—"}</td>
                    <td style={{ padding: "8px" }}>{row.buyer?.display_name ?? "—"}</td>
                    <td style={{ padding: "8px" }}>{row.seller?.display_name ?? "—"}</td>
                    <td style={{ padding: "8px" }}>{rub(row.amount_cents)}</td>
                    <td style={{ padding: "8px" }}>
                      <StatusBadge variant={ESCROW_STATUS_VARIANT[row.status] ?? "default"}>
                        {statusLabels[row.status] ?? row.status}
                      </StatusBadge>
                      {row.frozen && (
                        <span style={{ marginLeft: "6px", fontSize: "11px", color: "var(--danger)" }}>
                          <Snowflake size={12} style={{ display: "inline", verticalAlign: "middle" }} />
                        </span>
                      )}
                    </td>
                    <td style={{ padding: "8px" }}>
                      {row.shipment
                        ? `${row.shipment.provider} · ${row.shipment.status}`
                        : t("pages.adminEscrow.noShipment")}
                    </td>
                    <td style={{ padding: "8px" }}>
                      <button type="button" onClick={() => void openRow(row)} style={{ ...inputStyle, height: "32px" }}>
                        {t("pages.adminEscrow.details")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div style={{ ...card, marginTop: "16px", padding: "20px", borderColor: "var(--accent)" }}>
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 style={{ fontWeight: 700, fontSize: "16px" }}>{selected.listing?.title}</h3>
              <p style={{ marginTop: "4px", fontSize: "12px", color: "var(--foreground-50)" }}>UUID: {selected.uuid}</p>
            </div>
            <button type="button" onClick={() => setSelected(null)} style={{ ...inputStyle, height: "32px" }}>
              {t("pages.adminCommon.close")}
            </button>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3" style={{ gap: "12px", marginTop: "16px", fontSize: "13px" }}>
            <div>
              <span style={{ color: "var(--foreground-50)" }}>{t("pages.adminEscrow.detailStatus")}</span>{" "}
              {statusLabels[selected.status] ?? selected.status}
            </div>
            <div>
              <span style={{ color: "var(--foreground-50)" }}>{t("pages.adminEscrow.detailProvider")}</span> {selected.payment_provider}
            </div>
            <div>
              <span style={{ color: "var(--foreground-50)" }}>{t("pages.adminEscrow.detailFee")}</span> {rub(selected.platform_fee_cents)}
            </div>
            <div>
              <span style={{ color: "var(--foreground-50)" }}>{t("pages.adminEscrow.detailPayout")}</span> {rub(selected.seller_payout_cents)}
            </div>
            <div>
              <span style={{ color: "var(--foreground-50)" }}>{t("pages.adminEscrow.detailCaptured")}</span> {rub(selected.captured_cents)}
            </div>
            <div>
              <span style={{ color: "var(--foreground-50)" }}>{t("pages.adminEscrow.detailTrack")}</span>{" "}
              {selected.shipment?.tracking_number ?? "—"}
            </div>
          </div>

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--foreground-50)", marginBottom: "6px" }}>
              {t("pages.adminEscrow.actionReason")}
            </label>
            <textarea
              value={actionReason}
              onChange={(e) => setActionReason(e.target.value)}
              rows={2}
              className="w-full outline-none resize-y"
              style={{ ...inputStyle, height: "auto", minHeight: "56px", padding: "10px 14px" }}
              placeholder={t("pages.adminEscrow.actionReasonPlaceholder")}
            />
            <input
              type="text"
              value={partialAmount}
              onChange={(e) => setPartialAmount(e.target.value)}
              placeholder={t("pages.adminEscrow.partialAmountPlaceholder")}
              style={{ ...inputStyle, marginTop: "8px", maxWidth: "200px" }}
            />
          </div>

          <div className="flex flex-wrap gap-2" style={{ marginTop: "12px" }}>
            <button type="button" disabled={busy} style={primaryBtn} onClick={() => void runAction("sync-payment")}>
              {t("pages.adminEscrow.actions.sync")}
            </button>
            <button type="button" disabled={busy} style={primaryBtn} onClick={() => void runAction("capture", partialCents ? { amount_cents: partialCents } : {})}>
              {t("pages.adminEscrow.actions.capture")}
            </button>
            <button type="button" disabled={busy} style={primaryBtn} onClick={() => void runAction("reverse")}>
              {t("pages.adminEscrow.actions.reverse")}
            </button>
            <button
              type="button"
              disabled={busy}
              style={primaryBtn}
              onClick={() => partialCents && void runAction("refund", { amount_cents: partialCents })}
            >
              {t("pages.adminEscrow.actions.refund")}
            </button>
            <button
              type="button"
              disabled={busy}
              style={primaryBtn}
              onClick={() => void runAction("payout", partialCents ? { amount_cents: partialCents } : {})}
            >
              {t("pages.adminEscrow.actions.payout")}
            </button>
            <button type="button" disabled={busy} style={primaryBtn} onClick={() => void runAction("freeze")}>
              {t("pages.adminEscrow.actions.freeze")}
            </button>
            <button type="button" disabled={busy} style={primaryBtn} onClick={() => void runAction("unfreeze")}>
              {t("pages.adminEscrow.actions.unfreeze")}
            </button>
            <button type="button" disabled={busy} style={primaryBtn} onClick={() => void runAction("cancel")}>
              {t("pages.adminEscrow.actions.cancel")}
            </button>
          </div>

          {selected.dispute_status === "open" && (
            <div style={{ marginTop: "20px", padding: "16px", borderRadius: "var(--r-card)", border: "1px solid var(--danger)", background: "var(--background-surface)" }}>
              <h4 style={{ fontWeight: 700, fontSize: "14px", marginBottom: "12px", color: "var(--danger)" }}>
                {t("pages.adminEscrow.resolve.title")}
              </h4>
              <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--foreground-50)", marginBottom: "6px" }}>
                {t("pages.adminEscrow.resolve.outcome")}
              </label>
              <select
                value={resolveOutcome}
                onChange={(e) => setResolveOutcome(e.target.value as "buyer" | "seller" | "split")}
                style={{ ...inputStyle, marginBottom: "10px" }}
              >
                <option value="buyer">{t("pages.adminEscrow.resolve.buyer")}</option>
                <option value="seller">{t("pages.adminEscrow.resolve.seller")}</option>
                <option value="split">{t("pages.adminEscrow.resolve.split")}</option>
              </select>
              {resolveOutcome === "split" && (
                <div className="flex flex-wrap gap-2" style={{ marginBottom: "10px" }}>
                  <input
                    type="text"
                    value={buyerSplitAmount}
                    onChange={(e) => setBuyerSplitAmount(e.target.value)}
                    placeholder="Покупателю, ₽"
                    style={{ ...inputStyle, maxWidth: "160px" }}
                  />
                  <input
                    type="text"
                    value={sellerSplitAmount}
                    onChange={(e) => setSellerSplitAmount(e.target.value)}
                    placeholder="Продавцу, ₽"
                    style={{ ...inputStyle, maxWidth: "160px" }}
                  />
                </div>
              )}
              <button type="button" disabled={busy} style={{ ...primaryBtn, background: "var(--danger)" }} onClick={() => void runResolveDispute()}>
                {t("pages.adminEscrow.actions.resolveDispute")}
              </button>
            </div>
          )}

          {selected.operations && selected.operations.length > 0 && (
            <div style={{ marginTop: "20px" }}>
              <h4 style={{ fontWeight: 600, fontSize: "14px", marginBottom: "8px" }}>{t("pages.adminEscrow.operations")}</h4>
              <ul style={{ fontSize: "12px", color: "var(--foreground-70)", paddingLeft: "16px" }}>
                {selected.operations.slice(0, 10).map((op) => (
                  <li key={op.id}>
                    {op.type} · {op.status}
                    {op.amount_cents != null ? ` · ${rub(op.amount_cents)}` : ""} · {op.created_at ?? ""}
                  </li>
                ))}
              </ul>
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <label style={{ display: "block", fontSize: "12px", fontWeight: 600, color: "var(--foreground-50)", marginBottom: "6px" }}>
              {t("pages.adminEscrow.adminNote")}
            </label>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              className="w-full outline-none resize-y"
              style={{ ...inputStyle, height: "auto", minHeight: "80px", padding: "10px 14px" }}
            />
            <button type="button" disabled={busy} onClick={() => void saveNote()} style={{ ...primaryBtn, marginTop: "8px" }}>
              {t("pages.adminEscrow.saveNote")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
