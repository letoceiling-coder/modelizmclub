import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { previewEscrowFee } from "@/lib/api/admin-escrow";
import { fetchAdminSettings, updateAdminSettings, type AdminSetting } from "@/lib/api/admin";

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
  width: "100%",
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

function readNum(settings: AdminSetting[], key: string, field: string, fallback: number): number {
  const row = settings.find((s) => s.key === key);
  const v = row?.value as Record<string, unknown> | undefined;
  const n = Number(v?.[field]);
  return Number.isFinite(n) ? n : fallback;
}

function readBool(settings: AdminSetting[], key: string, fallback: boolean): boolean {
  const row = settings.find((s) => s.key === key);
  const v = row?.value as { enabled?: boolean } | undefined;
  return typeof v?.enabled === "boolean" ? v.enabled : fallback;
}

export function EscrowFeeSettingsCard() {
  const { t } = useTranslation();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [enabled, setEnabled] = useState(true);
  const [flatRub, setFlatRub] = useState("300");
  const [thresholdRub, setThresholdRub] = useState("1000");
  const [percent, setPercent] = useState("5");
  const [minRub, setMinRub] = useState("300");
  const [previewRub, setPreviewRub] = useState("800");
  const [previewFee, setPreviewFee] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    fetchAdminSettings()
      .then((rows) => {
        if (!active) return;
        setEnabled(readBool(rows, "escrow.fee.enabled", true));
        setFlatRub(String(readNum(rows, "escrow.fee.flat_amount_cents", "amount_cents", 30_000) / 100));
        setThresholdRub(String(readNum(rows, "escrow.fee.flat_threshold_cents", "threshold_cents", 100_000) / 100));
        setPercent(String(readNum(rows, "escrow.fee.percent", "percent", 5)));
        setMinRub(String(readNum(rows, "escrow.fee.min_cents", "min_cents", 30_000) / 100));
      })
      .catch(() => toast.error(t("pages.adminSettings.escrowFees.loadFailed")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [t]);

  useEffect(() => {
    const cents = Math.round(parseFloat(previewRub.replace(",", ".")) * 100);
    if (!Number.isFinite(cents) || cents < 0) return;
    let active = true;
    previewEscrowFee(cents)
      .then((q) => active && setPreviewFee(q.platform_fee_cents))
      .catch(() => active && setPreviewFee(null));
    return () => {
      active = false;
    };
  }, [previewRub, enabled, flatRub, thresholdRub, percent, minRub]);

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminSettings([
        { key: "escrow.fee.enabled", value: { enabled }, group: "escrow" },
        { key: "escrow.fee.flat_amount_cents", value: { amount_cents: Math.round(parseFloat(flatRub) * 100) }, group: "escrow" },
        { key: "escrow.fee.flat_threshold_cents", value: { threshold_cents: Math.round(parseFloat(thresholdRub) * 100) }, group: "escrow" },
        { key: "escrow.fee.percent", value: { percent: parseFloat(percent) }, group: "escrow" },
        { key: "escrow.fee.min_cents", value: { min_cents: Math.round(parseFloat(minRub) * 100) }, group: "escrow" },
      ]);
      toast.success(t("pages.adminSettings.escrowFees.saved"));
    } catch {
      toast.error(t("pages.adminSettings.escrowFees.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div style={{ ...card, padding: "20px", marginTop: 0, marginBottom: "16px", color: "var(--foreground-50)", fontSize: "13px" }}>
        {t("pages.adminCommon.loading")}
      </div>
    );
  }

  return (
    <div style={{ ...card, padding: "20px", marginTop: 0, marginBottom: "16px" }}>
      <h3 style={{ fontWeight: 700, fontSize: "15px", marginBottom: "4px" }}>{t("pages.adminSettings.escrowFees.title")}</h3>
      <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>{t("pages.adminSettings.escrowFees.subtitle")}</p>

      <label className="flex items-center gap-2 cursor-pointer" style={{ marginBottom: "16px" }}>
        <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} />
        <span style={{ fontSize: "13px" }}>{t("pages.adminSettings.escrowFees.enabled")}</span>
      </label>

      <div className="grid md:grid-cols-2 gap-3" style={{ marginBottom: "16px" }}>
        <label>
          <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>{t("pages.adminSettings.escrowFees.flatAmount")}</span>
          <input type="text" value={flatRub} onChange={(e) => setFlatRub(e.target.value)} style={{ ...inputStyle, marginTop: "4px" }} />
        </label>
        <label>
          <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>{t("pages.adminSettings.escrowFees.threshold")}</span>
          <input type="text" value={thresholdRub} onChange={(e) => setThresholdRub(e.target.value)} style={{ ...inputStyle, marginTop: "4px" }} />
        </label>
        <label>
          <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>{t("pages.adminSettings.escrowFees.percent")}</span>
          <input type="text" value={percent} onChange={(e) => setPercent(e.target.value)} style={{ ...inputStyle, marginTop: "4px" }} />
        </label>
        <label>
          <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>{t("pages.adminSettings.escrowFees.minFee")}</span>
          <input type="text" value={minRub} onChange={(e) => setMinRub(e.target.value)} style={{ ...inputStyle, marginTop: "4px" }} />
        </label>
      </div>

      <div style={{ padding: "12px", background: "var(--background)", borderRadius: "var(--r-card-sm)", marginBottom: "16px" }}>
        <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>{t("pages.adminSettings.escrowFees.preview")}</span>
        <div className="flex flex-wrap gap-2 items-center" style={{ marginTop: "8px" }}>
          <input type="text" value={previewRub} onChange={(e) => setPreviewRub(e.target.value)} style={{ ...inputStyle, maxWidth: "120px" }} />
          <span style={{ fontSize: "13px" }}>
            → {previewFee != null ? `${Math.round(previewFee / 100).toLocaleString("ru-RU")} ₽` : "—"}
          </span>
        </div>
      </div>

      <button type="button" disabled={saving} onClick={() => void save()} style={primaryBtn}>
        {saving ? t("pages.adminSettings.saving") : t("pages.adminSettings.escrowFees.save")}
      </button>
    </div>
  );
}
