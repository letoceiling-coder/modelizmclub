import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { fetchAdminSettings, updateAdminSettings } from "@/lib/api/admin";

type CardStyle = React.CSSProperties;

function readPromo(value: unknown): { enabled: boolean; total: number; taken: number } {
  const raw = value && typeof value === "object" ? (value as Record<string, unknown>) : {};
  return {
    enabled: raw.enabled === true,
    total: Math.max(0, Number(raw.total ?? 100) || 0),
    taken: Math.max(0, Number(raw.taken ?? 0) || 0),
  };
}

export function FirstHundredAdminCard({ cardStyle }: { cardStyle: CardStyle }) {
  const { t } = useTranslation();
  const [enabled, setEnabled] = useState(false);
  const [total, setTotal] = useState(100);
  const [taken, setTaken] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const reload = () => {
    setLoading(true);
    fetchAdminSettings()
      .then((rows) => {
        const row = rows.find((s) => s.key === "first_hundred_stats");
        const promo = readPromo(row?.value);
        setEnabled(promo.enabled);
        setTotal(promo.total);
        setTaken(promo.taken);
      })
      .catch(() => toast.error(t("pages.adminMonetization.firstHundred.loadFailed")))
      .finally(() => setLoading(false));
  };

  useEffect(reload, [t]);

  const save = async () => {
    const nextTotal = Math.max(0, Math.min(100000, Math.floor(Number(total) || 0)));
    setSaving(true);
    try {
      const [updated] = await updateAdminSettings([
        {
          key: "first_hundred_stats",
          group: "marketing",
          value: { enabled, total: nextTotal },
        },
      ]);
      const promo = readPromo(updated?.value);
      setEnabled(promo.enabled);
      setTotal(promo.total);
      setTaken(promo.taken);
      toast.success(t("pages.adminMonetization.firstHundred.saved"));
    } catch {
      toast.error(t("pages.adminMonetization.firstHundred.saveFailed"));
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

  const left = Math.max(0, total - taken);

  return (
    <div style={{ ...cardStyle, padding: 20, marginBottom: 16 }}>
      <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: 16, color: "var(--foreground)" }}>
        {t("pages.adminMonetization.firstHundred.title")}
      </h4>
      <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 6 }}>
        {t("pages.adminMonetization.firstHundred.subtitle")}
      </p>

      {loading ? (
        <p style={{ fontSize: 13, color: "var(--foreground-50)", marginTop: 12 }}>
          {t("pages.adminMonetization.firstHundred.loading")}
        </p>
      ) : (
        <>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="flex items-center gap-2 text-[13px]" style={{ color: "var(--foreground-70)" }}>
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
              />
              {t("pages.adminMonetization.firstHundred.toggle")}
            </label>
            <label style={{ display: "grid", gap: 4 }}>
              <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>
                {t("pages.adminMonetization.firstHundred.limitLabel")}
              </span>
              <input
                type="number"
                min={0}
                max={100000}
                value={total}
                onChange={(e) => setTotal(Number(e.target.value))}
                style={{ ...inputStyle, width: 120 }}
              />
            </label>
            <button type="button" onClick={save} disabled={saving} style={primaryBtn}>
              {saving ? t("pages.adminMonetization.firstHundred.saving") : t("pages.adminMonetization.firstHundred.save")}
            </button>
          </div>
          <p style={{ fontSize: 13, color: "var(--foreground-70)", marginTop: 12 }}>
            {t("pages.adminMonetization.firstHundred.progress", { taken, total, left })}
          </p>
        </>
      )}
    </div>
  );
}
