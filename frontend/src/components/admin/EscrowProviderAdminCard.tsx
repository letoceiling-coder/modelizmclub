import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { fetchAdminSettings, updateAdminSettings } from "@/lib/api/admin";
import { primaryBtn } from "@/components/admin/adminShared";

type CardStyle = React.CSSProperties;

const SETTING_KEY = "safe_deal.escrow_provider";
const GROUP = "billing";

type Provider = "vtb" | "wallet";

/**
 * Где держатся деньги безопасной сделки.
 *
 * Раньше значение жило только в `SAFE_DEAL_ESCROW_PROVIDER` и менялось правкой
 * .env с перезапуском php-fpm. Здесь тот же механизм, что у цены размещения:
 * системная настройка с записью в аудит.
 *
 * Показывается и сохранённый выбор, и фактический провайдер: они расходятся,
 * когда выбран банк, а эквайринг ВТБ не подключён — тогда сделки уходят на
 * кошелёк. Настройка распоряжается деньгами покупателя, и молчать о таком
 * расхождении нельзя.
 */
export function EscrowProviderAdminCard({ cardStyle }: { cardStyle: CardStyle }) {
  const { t } = useTranslation();
  const [saved, setSaved] = useState<Provider | null>(null);
  const [effective, setEffective] = useState<Provider | null>(null);
  const [choice, setChoice] = useState<Provider | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const readRow = (rows: Awaited<ReturnType<typeof fetchAdminSettings>>) => {
    const value = rows.find((r) => r.key === SETTING_KEY)?.value as
      | { provider?: Provider | null; effective?: Provider | null }
      | undefined;
    setSaved(value?.provider ?? null);
    setEffective(value?.effective ?? null);
    setChoice(value?.provider ?? null);
  };

  useEffect(() => {
    let active = true;
    fetchAdminSettings()
      .then((rows) => active && readRow(rows))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);

  const label = (p: Provider | null) =>
    p === "vtb"
      ? t("pages.adminMonetization.escrowProviderVtb")
      : p === "wallet"
        ? t("pages.adminMonetization.escrowProviderWallet")
        : t("pages.adminMonetization.escrowProviderNotSet");

  const save = async () => {
    if (!choice) return;
    setSaving(true);
    try {
      await updateAdminSettings([{ key: SETTING_KEY, value: { provider: choice }, group: GROUP }]);
      // Фактический провайдер считает сервер, а не форма: перечитываем, чтобы
      // не показать выбранное как действующее, если оно не применилось.
      readRow(await fetchAdminSettings());
      toast.success(t("pages.adminMonetization.escrowProviderSaved"));
    } catch {
      toast.error(t("pages.adminMonetization.escrowProviderSaveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const mismatch = saved !== null && effective !== null && saved !== effective;

  return (
    <div style={{ ...cardStyle, padding: "20px", marginBottom: "16px" }}>
      <h4
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "16px",
          color: "var(--foreground)",
        }}
      >
        {t("pages.adminMonetization.escrowProviderTitle")}
      </h4>
      <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginTop: "6px" }}>
        {t("pages.adminMonetization.escrowProviderHint")}
      </p>

      <div className="flex flex-wrap items-center gap-[10px]" style={{ marginTop: "12px" }}>
        {(["vtb", "wallet"] as const).map((p) => (
          <button
            key={p}
            type="button"
            disabled={loading}
            onClick={() => setChoice(p)}
            style={{
              minHeight: 40,
              padding: "0 16px",
              borderRadius: "var(--r-tag)",
              border: "1px solid",
              fontSize: "13px",
              fontWeight: 600,
              borderColor: choice === p ? "var(--accent)" : "var(--border)",
              background: choice === p ? "var(--accent-soft)" : "var(--background-elevated)",
              color: choice === p ? "var(--accent)" : "var(--foreground-70)",
            }}
          >
            {label(p)}
          </button>
        ))}
        <button
          onClick={save}
          disabled={saving || loading || !choice || choice === saved}
          style={primaryBtn}
        >
          {saving ? "…" : t("pages.adminCommon.save")}
        </button>
      </div>

      {/* Пока значение не пришло — не утверждаем ничего о том, куда идут деньги. */}
      <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginTop: "10px" }}>
        {loading
          ? "…"
          : t("pages.adminMonetization.escrowProviderEffective", { provider: label(effective) })}
      </p>
      {mismatch && (
        <p style={{ fontSize: "12px", color: "var(--danger)", marginTop: "4px" }}>
          {t("pages.adminMonetization.escrowProviderMismatch")}
        </p>
      )}
    </div>
  );
}
