import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import {
  fetchAdminDeliveryMethods,
  updateAdminDeliveryMethod,
  type AdminDeliveryMethodRow,
} from "@/lib/api/admin";
import { invalidateDeliveryMethodsCache } from "@/lib/hooks/useDeliveryMethods";

export function DeliveryMethodsAdminCard({ cardStyle }: { cardStyle: CSSProperties }) {
  const { t } = useTranslation();
  const [rows, setRows] = useState<AdminDeliveryMethodRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState<number | null>(null);

  const reload = () =>
    fetchAdminDeliveryMethods()
      .then(setRows)
      .catch(() => toast.error(t("pages.adminDeliveryMethods.loadFailed")));

  useEffect(() => {
    reload().finally(() => setLoading(false));
  }, [t]);

  const toggleActive = async (row: AdminDeliveryMethodRow) => {
    setSavingId(row.id);
    try {
      const updated = await updateAdminDeliveryMethod(row.id, { is_active: !row.is_active });
      setRows((list) => list.map((r) => (r.id === updated.id ? updated : r)));
      invalidateDeliveryMethodsCache();
      toast.success(t("pages.adminDeliveryMethods.saved"));
    } catch {
      toast.error(t("pages.adminDeliveryMethods.saveFailed"));
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div style={{ ...cardStyle, padding: "20px", marginBottom: 16 }}>
      <h4
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "16px",
          color: "var(--foreground)",
        }}
      >
        {t("pages.adminDeliveryMethods.title")}
      </h4>
      <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginTop: 6 }}>
        {t("pages.adminDeliveryMethods.hint")}
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 12 }}>
          {t("pages.adminCommon.loading")}
        </p>
      ) : (
        <div style={{ marginTop: 12, display: "grid", gap: 8 }}>
          {rows.map((row) => (
            <div
              key={row.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 12px",
                border: "1px solid var(--border)",
                borderRadius: "var(--r-card-sm)",
              }}
            >
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>
                  {row.name}
                </div>
                <div style={{ fontSize: 12, color: "var(--foreground-50)", marginTop: 2 }}>
                  {row.code}
                  {row.is_integrated
                    ? ` · ${t("pages.adminDeliveryMethods.integrated")}`
                    : ` · ${t("pages.adminDeliveryMethods.labelOnly")}`}
                </div>
              </div>
              <button
                type="button"
                disabled={savingId === row.id}
                onClick={() => void toggleActive(row)}
                className="rounded-[var(--r-pill)] px-3 py-1.5 text-xs font-semibold"
                style={{
                  background: row.is_active ? "var(--accent-soft)" : "var(--background-surface)",
                  color: row.is_active ? "var(--accent)" : "var(--foreground-50)",
                  border: "1px solid var(--border)",
                }}
              >
                {row.is_active
                  ? t("pages.adminDeliveryMethods.active")
                  : t("pages.adminDeliveryMethods.inactive")}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
