import { useEffect, useMemo, useState } from "react";
import type { ComponentProps } from "react";
import { useTranslation } from "react-i18next";
import { Truck, DollarSign, AlertCircle, BarChart3 } from "lucide-react";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/format/date";
import { StatusBadge } from "@/components/StatusBadge";
import { DeliveryMethodsAdminCard } from "@/components/admin/DeliveryMethodsAdminCard";
import {
  fetchAdminDeliveryStats,
  fetchAdminShipments,
  updateAdminShipment,
  type AdminDeliveryStats,
  type AdminShipmentRow,
} from "@/lib/api/admin";
import { H, card, inputStyle, primaryBtn } from "@/components/admin/adminShared";

type StatusVariant = NonNullable<ComponentProps<typeof StatusBadge>["variant"]>;

export function DeliverySection() {
  const { t } = useTranslation();
  const shipmentStatusMeta = useMemo<Record<string, { label: string; variant: StatusVariant }>>(
    () => ({
      draft: { label: t("pages.adminDelivery.status.draft"), variant: "default" },
      quoted: { label: t("pages.adminDelivery.status.quoted"), variant: "info" },
      awaiting_seller: {
        label: t("pages.adminDelivery.status.awaiting_seller"),
        variant: "warning",
      },
      creating: { label: t("pages.adminDelivery.status.creating"), variant: "info" },
      created: { label: t("pages.adminDelivery.status.created"), variant: "info" },
      accepted: { label: t("pages.adminDelivery.status.accepted"), variant: "info" },
      in_transit: { label: t("pages.adminDelivery.status.in_transit"), variant: "info" },
      at_pickup: { label: t("pages.adminDelivery.status.at_pickup"), variant: "warning" },
      delivered: { label: t("pages.adminDelivery.status.delivered"), variant: "success" },
      cancelled: { label: t("pages.adminDelivery.status.cancelled"), variant: "default" },
      error: { label: t("pages.adminDelivery.status.error"), variant: "danger" },
    }),
    [t],
  );
  const providerLabels = useMemo(
    () => ({
      cdek: t("pages.adminDelivery.providers.cdek"),
      yandex: t("pages.adminDelivery.providers.yandex"),
    }),
    [t],
  );
  const [stats, setStats] = useState<AdminDeliveryStats | null>(null);
  const [status, setStatus] = useState("all");
  const [provider, setProvider] = useState("all");
  const [rows, setRows] = useState<AdminShipmentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<AdminShipmentRow | null>(null);
  const [noteDraft, setNoteDraft] = useState("");
  const [savingNote, setSavingNote] = useState(false);

  useEffect(() => {
    let active = true;
    fetchAdminDeliveryStats()
      .then((d) => active && setStats(d))
      .catch(() => active && toast.error(t("pages.adminDelivery.loadStatsFailed")));
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminShipments({ status, provider })
      .then((list) => active && setRows(list))
      .catch(() => active && toast.error(t("pages.adminDelivery.loadShipmentsFailed")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [status, provider, t]);

  const openRow = (row: AdminShipmentRow) => {
    setSelected(row);
    setNoteDraft(row.adminNote ?? "");
  };

  const saveNote = async () => {
    if (!selected) return;
    setSavingNote(true);
    try {
      const updated = await updateAdminShipment(selected.uuid, {
        admin_note: noteDraft.trim() || null,
      });
      setRows((list) => list.map((r) => (r.uuid === updated.uuid ? updated : r)));
      setSelected(updated);
      toast.success(t("pages.adminDelivery.noteSaved"));
    } catch {
      toast.error(t("pages.adminDelivery.noteSaveFailed"));
    } finally {
      setSavingNote(false);
    }
  };

  const statCards = useMemo(
    () => [
      {
        v: String(stats?.shipmentsTotal ?? 0),
        l: t("pages.adminDelivery.statShipments"),
        icon: Truck,
      },
      {
        v: `${Math.round((stats?.deliveryRevenueCents ?? 0) / 100).toLocaleString("ru")} ₽`,
        l: t("pages.adminDelivery.statRevenue"),
        icon: DollarSign,
      },
      {
        v: String(stats?.errorsLast7d ?? 0),
        l: t("pages.adminDelivery.statErrors"),
        icon: AlertCircle,
        warn: (stats?.errorsLast7d ?? 0) > 0,
      },
      {
        v:
          stats?.avgDeliveryDays != null
            ? `${stats.avgDeliveryDays} ${t("pages.adminDelivery.daysShort")}`
            : "—",
        l: t("pages.adminDelivery.statAvgDays"),
        icon: BarChart3,
      },
    ],
    [stats, t],
  );

  const tableHeaders = useMemo(
    () => [
      t("pages.adminDelivery.colListing"),
      t("pages.adminDelivery.colProvider"),
      t("pages.adminDelivery.colStatus"),
      t("pages.adminDelivery.colTrack"),
      t("pages.adminDelivery.colCost"),
      t("pages.adminDelivery.colCreated"),
      "",
    ],
    [t],
  );

  return (
    <div>
      <H>{t("pages.adminDelivery.title")}</H>

      <DeliveryMethodsAdminCard cardStyle={card} />

      <div
        className="grid grid-cols-2 lg:grid-cols-4"
        style={{ gap: "12px", marginBottom: "20px" }}
      >
        {statCards.map((s, i) => (
          <div key={i} style={{ ...card, padding: "16px" }}>
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--r-pill)",
                background: s.warn ? "var(--warning-soft)" : "var(--accent-soft)",
                display: "grid",
                placeItems: "center",
                marginBottom: "12px",
              }}
            >
              <s.icon size={18} style={{ color: s.warn ? "var(--warning)" : "var(--accent)" }} />
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: "24px",
                color: "var(--foreground)",
              }}
            >
              {s.v}
            </div>
            <div style={{ fontSize: "12px", color: "var(--foreground-50)", marginTop: "4px" }}>
              {s.l}
            </div>
          </div>
        ))}
      </div>

      {stats && Object.keys(stats.shipmentsByProvider).length > 0 && (
        <div
          style={{
            ...card,
            padding: "16px",
            marginBottom: "16px",
            fontSize: "13px",
            color: "var(--foreground-70)",
          }}
        >
          {t("pages.adminDelivery.byProviders")}{" "}
          {Object.entries(stats.shipmentsByProvider).map(([p, n]) => (
            <span key={p} style={{ marginRight: "12px" }}>
              <strong style={{ color: "var(--foreground)" }}>
                {providerLabels[p as keyof typeof providerLabels] ?? p}
              </strong>
              : {n}
            </span>
          ))}
        </div>
      )}

      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">{t("pages.adminCommon.allStatuses")}</option>
          {Object.entries(shipmentStatusMeta).map(([k, m]) => (
            <option key={k} value={k}>
              {m.label}
            </option>
          ))}
        </select>
        <select
          value={provider}
          onChange={(e) => setProvider(e.target.value)}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">{t("pages.adminDelivery.allProviders")}</option>
          <option value="cdek">{providerLabels.cdek}</option>
          <option value="yandex">{providerLabels.yandex}</option>
        </select>
      </div>

      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "860px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                {tableHeaders.map((h) => (
                  <th
                    key={h || "actions"}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--foreground-50)",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} style={{ padding: "16px", color: "var(--foreground-50)" }}>
                    {t("pages.adminCommon.loading")}
                  </td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={7}
                    style={{
                      padding: "32px 16px",
                      textAlign: "center",
                      color: "var(--foreground-50)",
                    }}
                  >
                    <Truck
                      size={32}
                      style={{ color: "var(--foreground-15)", margin: "0 auto 12px" }}
                    />
                    {t("pages.adminDelivery.empty")}
                  </td>
                </tr>
              ) : (
                rows.map((row) => {
                  const meta = shipmentStatusMeta[row.status] ?? {
                    label: row.status,
                    variant: "default" as const,
                  };
                  return (
                    <tr key={row.uuid} style={{ borderTop: "1px solid var(--border)" }}>
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "var(--foreground)",
                          fontWeight: 500,
                          maxWidth: "220px",
                        }}
                      >
                        {row.listingTitle}
                      </td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                        {providerLabels[row.provider as keyof typeof providerLabels] ??
                          row.provider}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "var(--foreground-70)",
                          fontFamily: "var(--font-mono)",
                          fontSize: "12px",
                        }}
                      >
                        {row.trackingNumber ?? row.externalId ?? "—"}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "var(--foreground)",
                          fontWeight: 600,
                        }}
                      >
                        {row.deliveryCostCents != null
                          ? `${Math.round(row.deliveryCostCents / 100).toLocaleString("ru")} ₽`
                          : "—"}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "var(--foreground-50)",
                          fontSize: "12px",
                        }}
                      >
                        {row.createdAt ? formatDate(row.createdAt, "absolute") : "—"}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <button
                          type="button"
                          onClick={() => openRow(row)}
                          style={{ ...primaryBtn, height: "32px", fontSize: "12px" }}
                        >
                          {t("pages.adminDelivery.details")}
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selected && (
        <div
          style={{
            ...card,
            marginTop: "16px",
            padding: "20px",
            borderColor: "var(--accent)",
          }}
        >
          <div className="flex items-start justify-between gap-3 flex-wrap">
            <div>
              <h3 style={{ fontWeight: 700, fontSize: "16px", color: "var(--foreground)" }}>
                {selected.listingTitle}
              </h3>
              <p style={{ marginTop: "4px", fontSize: "12px", color: "var(--foreground-50)" }}>
                UUID: {selected.uuid}
              </p>
            </div>
            <button
              type="button"
              onClick={() => setSelected(null)}
              style={{ ...inputStyle, height: "32px", padding: "0 12px" }}
            >
              {t("pages.adminCommon.close")}
            </button>
          </div>

          <div
            className="grid md:grid-cols-2"
            style={{ gap: "12px", marginTop: "16px", fontSize: "13px" }}
          >
            <div>
              <span style={{ color: "var(--foreground-50)" }}>
                {t("pages.adminDelivery.detailProvider")}
              </span>{" "}
              {providerLabels[selected.provider as keyof typeof providerLabels] ??
                selected.provider}
            </div>
            <div>
              <span style={{ color: "var(--foreground-50)" }}>
                {t("pages.adminDelivery.detailStatus")}
              </span>{" "}
              {shipmentStatusMeta[selected.status]?.label ?? selected.status}
            </div>
            <div>
              <span style={{ color: "var(--foreground-50)" }}>
                {t("pages.adminDelivery.detailTrack")}
              </span>{" "}
              {selected.trackingNumber ?? "—"}
            </div>
            <div>
              <span style={{ color: "var(--foreground-50)" }}>
                {t("pages.adminDelivery.detailExternalId")}
              </span>{" "}
              {selected.externalId ?? "—"}
            </div>
          </div>

          {selected.errorMessage && (
            <div
              style={{
                marginTop: "12px",
                padding: "12px",
                borderRadius: "var(--r-card-sm)",
                background: "var(--danger-soft)",
                color: "var(--danger)",
                fontSize: "13px",
              }}
            >
              {selected.errorMessage}
            </div>
          )}

          <div style={{ marginTop: "16px" }}>
            <label
              style={{
                display: "block",
                fontSize: "12px",
                fontWeight: 600,
                color: "var(--foreground-50)",
                marginBottom: "6px",
              }}
            >
              {t("pages.adminDelivery.adminNote")}
            </label>
            <textarea
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              rows={3}
              className="w-full outline-none resize-y"
              style={{
                ...inputStyle,
                height: "auto",
                minHeight: "80px",
                padding: "10px 14px",
              }}
              placeholder={t("pages.adminDelivery.adminNotePlaceholder")}
            />
            <button
              type="button"
              disabled={savingNote}
              onClick={() => void saveNote()}
              style={{ ...primaryBtn, marginTop: "8px" }}
            >
              {savingNote ? t("pages.adminDelivery.savingNote") : t("pages.adminDelivery.saveNote")}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
