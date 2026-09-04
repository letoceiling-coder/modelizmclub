import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { setFeatureFlag, loadFeatureFlagsFromServer } from "@/lib/config/featureFlags";
import { isDemoMode } from "@/lib/demo-mode";
import { fetchAdminSettings, updateAdminSettings, type AdminSetting } from "@/lib/api/admin";
import { FooterContactsAdminCard } from "@/components/admin/FooterContactsAdminCard";
import { H, card, primaryBtn } from "@/components/admin/adminShared";

type SettingMeta = {
  label: string;
  hint?: string;
  hidden?: boolean;
  fieldLabels?: Record<string, string>;
};

/* Human-readable metadata for system settings. The admin NEVER sees or edits
   raw JSON — every known key gets a labeled toggle/input; unknown keys fall
   back by value shape (boolean → тумблер, string/number → инпут, plain
   object → labeled per-field inputs). */
function useSettingMeta() {
  const { t } = useTranslation();
  return useMemo<Record<string, SettingMeta>>(
    () => ({
      "feature.reviews_enabled": {
        label: t("pages.adminSettings.settingMeta.feature_reviews_enabled.label"),
        hint: t("pages.adminSettings.settingMeta.feature_reviews_enabled.hint"),
        hidden: true,
      },
      "feature.market_enabled": {
        label: t("pages.adminSettings.settingMeta.feature_market_enabled.label"),
        hidden: true,
      },
      "feature.escrow_enabled": {
        label: t("pages.adminSettings.settingMeta.feature_escrow_enabled.label"),
        hidden: true,
      },
      "feature.feed_auto_publish": {
        label: t("pages.adminSettings.settingMeta.feature_feed_auto_publish.label"),
        hidden: true,
      },
      "feature.listing_payment_enabled": {
        label: t("pages.adminSettings.settingMeta.feature_listing_payment_enabled.label"),
        hidden: true,
      },
      icon_overrides: {
        label: t("pages.adminSettings.settingMeta.icon_overrides.label"),
        hidden: true,
      },
      "footer.contacts": {
        label: t("pages.adminSettings.settingMeta.footer_contacts.label"),
        hidden: true,
      },
      site_name: {
        label: t("pages.adminSettings.settingMeta.site_name.label"),
        fieldLabels: {
          ru: t("pages.adminSettings.settingMeta.site_name.fields.ru"),
          en: t("pages.adminSettings.settingMeta.site_name.fields.en"),
        },
      },
      first_hundred_stats: {
        label: t("pages.adminSettings.settingMeta.first_hundred_stats.label"),
        hidden: true,
        fieldLabels: {
          taken: t("pages.adminSettings.settingMeta.first_hundred_stats.fields.taken"),
          total: t("pages.adminSettings.settingMeta.first_hundred_stats.fields.total"),
        },
      },
      moderation_auto_publish: {
        label: t("pages.adminSettings.settingMeta.moderation_auto_publish.label"),
        hint: t("pages.adminSettings.settingMeta.moderation_auto_publish.hint"),
      },
    }),
    [t],
  );
}

function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

/** {enabled: boolean} (possibly the only key) → treat as a single toggle. */
function isEnabledShape(v: unknown): v is { enabled: boolean } {
  return isPlainObject(v) && Object.keys(v).length === 1 && typeof v.enabled === "boolean";
}

function readEnabledSetting(settings: AdminSetting[], key: string, fallback = false): boolean {
  const row = settings.find((s) => s.key === key);
  return isEnabledShape(row?.value) ? row.value.enabled : fallback;
}

function mergeAdminSettings(prev: AdminSetting[], updated: AdminSetting[]): AdminSetting[] {
  if (updated.length === 0) return prev;
  const byKey = new Map(prev.map((s) => [s.key, s]));
  for (const row of updated) byKey.set(row.key, row);
  return Array.from(byKey.values());
}

function draftsFromSettings(rows: AdminSetting[]): Record<string, unknown> {
  const d: Record<string, unknown> = {};
  for (const s of rows) d[s.key] = structuredClone(s.value);
  return d;
}

/** Saved immediately by dedicated cards — must not be overwritten by the bulk «Сохранить» drafts. */
const CARD_MANAGED_SETTING_KEYS = new Set([
  "feature.communities_enabled",
  "feature.reviews_enabled",
  "feature.market_enabled",
  "feature.escrow_enabled",
  "feature.feed_auto_publish",
  "feature.listing_payment_enabled",
  "first_hundred_stats",
  "notifications.policy",
]);

export function SettingsSection() {
  const { t } = useTranslation();
  const SETTING_META = useSettingMeta();
  const [settings, setSettings] = useState<AdminSetting[]>([]);
  const [drafts, setDrafts] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchAdminSettings()
      .then(async (rows) => {
        setSettings(rows);
        setDrafts(draftsFromSettings(rows));
        await loadFeatureFlagsFromServer();
      })
      .catch(() => toast.error(t("pages.adminSettings.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  const setDraft = (key: string, value: unknown) => setDrafts((p) => ({ ...p, [key]: value }));

  const setDraftField = (key: string, field: string, value: unknown) =>
    setDrafts((p) => {
      const cur = isPlainObject(p[key]) ? { ...(p[key] as Record<string, unknown>) } : {};
      cur[field] = value;
      return { ...p, [key]: cur };
    });

  const save = async () => {
    const next: AdminSetting[] = settings
      .filter((s) => !CARD_MANAGED_SETTING_KEYS.has(s.key))
      .map((s) => ({
        key: s.key,
        value: drafts[s.key] ?? s.value,
        group: s.group,
      }));
    setSaving(true);
    try {
      if (next.length > 0) {
        await updateAdminSettings(next);
      }
      const rows = await fetchAdminSettings();
      setSettings(rows);
      setDrafts(draftsFromSettings(rows));
      await loadFeatureFlagsFromServer();
      toast.success(t("pages.adminSettings.saved"));
    } catch {
      toast.error(t("pages.adminSettings.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const groups = useMemo(() => {
    const map = new Map<string, AdminSetting[]>();
    for (const s of settings) {
      if (SETTING_META[s.key]?.hidden) continue;
      const arr = map.get(s.group) ?? [];
      arr.push(s);
      map.set(s.group, arr);
    }
    return Array.from(map.entries()).filter(([, rows]) => rows.length > 0);
  }, [settings, SETTING_META]);

  const inputStyle: CSSProperties = {
    height: "40px",
    background: "var(--background)",
    border: "1.5px solid var(--border)",
    borderRadius: "var(--r-input)",
    padding: "0 14px",
    fontSize: "13px",
    color: "var(--foreground)",
  };

  /** One field inside an object-valued setting (string/number/boolean). */
  const renderField = (key: string, field: string, value: unknown) => {
    const meta = SETTING_META[key];
    const label = meta?.fieldLabels?.[field] ?? field;
    if (typeof value === "boolean") {
      return (
        <label
          key={field}
          className="flex items-center gap-[8px] cursor-pointer"
          style={{ height: 32 }}
        >
          <input
            type="checkbox"
            checked={value}
            onChange={(e) => setDraftField(key, field, e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>
            {label}
          </span>
        </label>
      );
    }
    if (typeof value === "number") {
      return (
        <label key={field} style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground-70)" }}>
            {label}
          </span>
          <input
            type="number"
            value={value}
            onChange={(e) => setDraftField(key, field, Number(e.target.value))}
            className="outline-none"
            style={{ ...inputStyle, maxWidth: 180 }}
          />
        </label>
      );
    }
    if (typeof value === "string") {
      return (
        <label key={field} style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground-70)" }}>
            {label}
          </span>
          <input
            type="text"
            value={value}
            onChange={(e) => setDraftField(key, field, e.target.value)}
            className="outline-none"
            style={inputStyle}
          />
        </label>
      );
    }
    // Nested structures are system-managed — never expose raw JSON.
    return (
      <p key={field} style={{ fontSize: "12px", color: "var(--foreground-50)" }}>
        «{label}» {t("pages.adminSettings.systemManaged")}
      </p>
    );
  };

  /** Full control block for a single setting, chosen by value shape. */
  const renderSetting = (s: AdminSetting) => {
    const meta = SETTING_META[s.key];
    const label = meta?.label ?? s.key;
    const value = drafts[s.key];

    // Toggle: plain boolean or the {enabled: bool} convention.
    if (typeof value === "boolean" || isEnabledShape(value)) {
      const checked = typeof value === "boolean" ? value : value.enabled;
      return (
        <div key={s.key} style={{ display: "grid", gap: "4px" }}>
          <label className="flex items-center gap-[8px] cursor-pointer" style={{ height: 32 }}>
            <input
              type="checkbox"
              checked={checked}
              onChange={(e) =>
                typeof value === "boolean"
                  ? setDraft(s.key, e.target.checked)
                  : setDraftField(s.key, "enabled", e.target.checked)
              }
              style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
            />
            <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>
              {label}
            </span>
          </label>
          {meta?.hint && (
            <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginLeft: 26 }}>
              {meta.hint}
            </p>
          )}
        </div>
      );
    }

    if (typeof value === "string" || typeof value === "number") {
      return (
        <label key={s.key} style={{ display: "grid", gap: "6px" }}>
          <span style={{ fontSize: "12px", fontWeight: 500, color: "var(--foreground-70)" }}>
            {label}
          </span>
          <input
            type={typeof value === "number" ? "number" : "text"}
            value={value}
            onChange={(e) =>
              setDraft(s.key, typeof value === "number" ? Number(e.target.value) : e.target.value)
            }
            className="outline-none"
            style={{ ...inputStyle, maxWidth: typeof value === "number" ? 180 : undefined }}
          />
        </label>
      );
    }

    if (isPlainObject(value)) {
      return (
        <div key={s.key} style={{ display: "grid", gap: "10px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>
            {label}
          </span>
          {meta?.hint && (
            <p style={{ fontSize: "12px", color: "var(--foreground-50)" }}>{meta.hint}</p>
          )}
          <div style={{ display: "grid", gap: "10px", paddingLeft: 2 }}>
            {Object.entries(value).map(([field, v]) => renderField(s.key, field, v))}
          </div>
        </div>
      );
    }

    // Arrays / null / anything exotic — system-managed, no raw JSON editing.
    return (
      <p key={s.key} style={{ fontSize: "12px", color: "var(--foreground-50)" }}>
        «{label}» {t("pages.adminSettings.systemManaged")}
      </p>
    );
  };

  const reviewsEnabledSetting = readEnabledSetting(settings, "feature.reviews_enabled", true);
  const communitiesEnabled = readEnabledSetting(settings, "feature.communities_enabled", false);
  const marketEnabled = readEnabledSetting(settings, "feature.market_enabled", false);
  const escrowEnabled = readEnabledSetting(settings, "feature.escrow_enabled", false);
  const listingPaymentEnabled = readEnabledSetting(
    settings,
    "feature.listing_payment_enabled",
    false,
  );
  const [savingCommunities, setSavingCommunities] = useState(false);
  const [savingReviews, setSavingReviews] = useState(false);
  const [savingMarket, setSavingMarket] = useState(false);
  const [savingEscrow, setSavingEscrow] = useState(false);
  const [savingListingPayment, setSavingListingPayment] = useState(false);

  // Server-persisted (SystemSetting: feature.feed_auto_publish). Not part of the
  // public feature-flags endpoint — it only affects the backend publish path.
  // Absent/false → moderation ON (posts wait in queue). Read straight from the
  // loaded settings so it reflects the real server state.
  const feedAutoPublish = readEnabledSetting(settings, "feature.feed_auto_publish", false);
  const [savingFeedAutoPublish, setSavingFeedAutoPublish] = useState(false);

  const toggleFeedAutoPublish = async (checked: boolean) => {
    if (isDemoMode()) {
      toast(t("pages.adminSettings.demoModeToast"));
      return;
    }
    setSavingFeedAutoPublish(true);
    try {
      const [updated] = await updateAdminSettings([
        { key: "feature.feed_auto_publish", value: { enabled: checked }, group: "feed" },
      ]);
      setSettings((prev) => mergeAdminSettings(prev, updated ? [updated] : []));
      setDrafts((prev) => ({ ...prev, "feature.feed_auto_publish": { enabled: checked } }));
      toast.success(
        checked
          ? t("pages.adminSettings.featureCards.feedAutoPublish.enabled")
          : t("pages.adminSettings.featureCards.feedAutoPublish.disabled"),
      );
    } catch {
      toast.error(t("pages.adminSettings.saveSettingFailed"));
    } finally {
      setSavingFeedAutoPublish(false);
    }
  };

  const toggleReviews = async (checked: boolean) => {
    if (isDemoMode()) {
      toast(t("pages.adminSettings.demoModeToast"));
      return;
    }
    setSavingReviews(true);
    try {
      const [updated] = await updateAdminSettings([
        { key: "feature.reviews_enabled", value: { enabled: checked }, group: "features" },
      ]);
      setSettings((prev) => mergeAdminSettings(prev, updated ? [updated] : []));
      setDrafts((prev) => ({ ...prev, "feature.reviews_enabled": { enabled: checked } }));
      await loadFeatureFlagsFromServer();
      toast.success(
        checked
          ? t("pages.adminSettings.featureCards.reviews.enabled")
          : t("pages.adminSettings.featureCards.reviews.disabled"),
      );
    } catch {
      toast.error(t("pages.adminSettings.saveSettingFailed"));
    } finally {
      setSavingReviews(false);
    }
  };

  const toggleCommunities = async (checked: boolean) => {
    if (isDemoMode()) {
      toast(t("pages.adminSettings.demoModeToast"));
      return;
    }
    setSavingCommunities(true);
    try {
      const [updated] = await updateAdminSettings([
        { key: "feature.communities_enabled", value: { enabled: checked }, group: "features" },
      ]);
      setSettings((prev) => mergeAdminSettings(prev, updated ? [updated] : []));
      setDrafts((prev) => ({ ...prev, "feature.communities_enabled": { enabled: checked } }));
      await loadFeatureFlagsFromServer();
      toast.success(
        checked
          ? t("pages.adminSettings.featureCards.communities.enabled")
          : t("pages.adminSettings.featureCards.communities.disabled"),
      );
    } catch {
      toast.error(t("pages.adminSettings.saveSettingFailed"));
    } finally {
      setSavingCommunities(false);
    }
  };

  const toggleMarket = async (checked: boolean) => {
    if (isDemoMode()) {
      setFeatureFlag("marketEnabled", checked);
      toast(t("pages.adminSettings.demoModeFlagToast"));
      return;
    }
    setSavingMarket(true);
    try {
      const [updated] = await updateAdminSettings([
        { key: "feature.market_enabled", value: { enabled: checked }, group: "feature" },
      ]);
      setSettings((prev) => mergeAdminSettings(prev, updated ? [updated] : []));
      setDrafts((prev) => ({ ...prev, "feature.market_enabled": { enabled: checked } }));
      await loadFeatureFlagsFromServer();
      toast.success(
        checked
          ? t("pages.adminSettings.featureCards.market.enabled")
          : t("pages.adminSettings.featureCards.market.disabled"),
      );
    } catch {
      toast.error(t("pages.adminSettings.saveSettingFailed"));
    } finally {
      setSavingMarket(false);
    }
  };

  const toggleEscrow = async (checked: boolean) => {
    if (isDemoMode()) {
      setFeatureFlag("escrowEnabled", checked);
      toast(t("pages.adminSettings.demoModeFlagToast"));
      return;
    }
    setSavingEscrow(true);
    try {
      const [updated] = await updateAdminSettings([
        { key: "feature.escrow_enabled", value: { enabled: checked }, group: "feature" },
      ]);
      setSettings((prev) => mergeAdminSettings(prev, updated ? [updated] : []));
      setDrafts((prev) => ({ ...prev, "feature.escrow_enabled": { enabled: checked } }));
      await loadFeatureFlagsFromServer();
      toast.success(
        checked
          ? t("pages.adminSettings.featureCards.escrow.enabled")
          : t("pages.adminSettings.featureCards.escrow.disabled"),
      );
    } catch {
      toast.error(t("pages.adminSettings.saveSettingFailed"));
    } finally {
      setSavingEscrow(false);
    }
  };

  const toggleListingPayment = async (checked: boolean) => {
    if (isDemoMode()) {
      setFeatureFlag("listingPaymentEnabled", checked);
      toast(t("pages.adminSettings.demoModeFlagToast"));
      return;
    }
    setSavingListingPayment(true);
    try {
      const [updated] = await updateAdminSettings([
        { key: "feature.listing_payment_enabled", value: { enabled: checked }, group: "feature" },
      ]);
      setSettings((prev) => mergeAdminSettings(prev, updated ? [updated] : []));
      setDrafts((prev) => ({ ...prev, "feature.listing_payment_enabled": { enabled: checked } }));
      await loadFeatureFlagsFromServer();
      toast.success(
        checked
          ? t("pages.adminSettings.featureCards.listingPayment.enabled")
          : t("pages.adminSettings.featureCards.listingPayment.disabled"),
      );
    } catch {
      toast.error(t("pages.adminSettings.saveSettingFailed"));
    } finally {
      setSavingListingPayment(false);
    }
  };

  return (
    <div>
      <H>{t("pages.adminSettings.title")}</H>

      {/* Server-persisted (SystemSetting: feature.reviews_enabled). */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "16px",
            color: "var(--foreground)",
            marginBottom: "4px",
          }}
        >
          {t("pages.adminSettings.featureCards.reviews.title")}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminSettings.featureCards.reviews.subtitle")}
        </p>
        <label
          className="flex items-center gap-[8px] cursor-pointer"
          style={{ height: 36, opacity: savingReviews ? 0.6 : 1 }}
        >
          <input
            type="checkbox"
            checked={reviewsEnabledSetting}
            disabled={savingReviews}
            onChange={(e) => void toggleReviews(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>
            {t("pages.adminSettings.featureCards.reviews.toggle")}
          </span>
        </label>
      </div>

      {/* Server-persisted (SystemSetting: feature.communities_enabled). */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "16px",
            color: "var(--foreground)",
            marginBottom: "4px",
          }}
        >
          {t("pages.adminSettings.featureCards.communities.title")}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminSettings.featureCards.communities.subtitle")}
        </p>
        <label
          className="flex items-center gap-[8px] cursor-pointer"
          style={{ height: 36, opacity: savingCommunities ? 0.6 : 1 }}
        >
          <input
            type="checkbox"
            checked={communitiesEnabled}
            disabled={savingCommunities}
            onChange={(e) => void toggleCommunities(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>
            {t("pages.adminSettings.featureCards.communities.toggle")}
          </span>
        </label>
      </div>

      {/* Server-persisted (SystemSetting: feature.market_enabled via the same
          /admin/settings endpoint below) — unlike the flags above, this one
          actually changes what every visitor sees, not just this browser. */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "16px",
            color: "var(--foreground)",
            marginBottom: "4px",
          }}
        >
          {t("pages.adminSettings.featureCards.market.title")}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminSettings.featureCards.market.subtitle")}
        </p>
        <label
          className="flex items-center gap-[8px] cursor-pointer"
          style={{ height: 36, opacity: savingMarket ? 0.6 : 1 }}
        >
          <input
            type="checkbox"
            checked={marketEnabled}
            disabled={savingMarket}
            onChange={(e) => void toggleMarket(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>
            {t("pages.adminSettings.featureCards.market.toggle")}
          </span>
        </label>
      </div>

      {/* Server-persisted (SystemSetting: feature.escrow_enabled). Off by
          default — turn on only once ЮKassa Безопасная сделка is live on the
          backend, so the escrow badge never promises an unimplemented feature. */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "16px",
            color: "var(--foreground)",
            marginBottom: "4px",
          }}
        >
          {t("pages.adminSettings.featureCards.escrow.title")}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminSettings.featureCards.escrow.subtitle")}
        </p>
        <label
          className="flex items-center gap-[8px] cursor-pointer"
          style={{ height: 36, opacity: savingEscrow ? 0.6 : 1 }}
        >
          <input
            type="checkbox"
            checked={escrowEnabled}
            disabled={savingEscrow}
            onChange={(e) => void toggleEscrow(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>
            {t("pages.adminSettings.featureCards.escrow.toggle")}
          </span>
        </label>
      </div>

      {/* Server-persisted (SystemSetting: feature.listing_payment_enabled). Off
          by default — ads publish for free until billing is wired in the wizard. */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "16px",
            color: "var(--foreground)",
            marginBottom: "4px",
          }}
        >
          {t("pages.adminSettings.featureCards.listingPayment.title")}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminSettings.featureCards.listingPayment.subtitle")}
        </p>
        <label
          className="flex items-center gap-[8px] cursor-pointer"
          style={{ height: 36, opacity: savingListingPayment ? 0.6 : 1 }}
        >
          <input
            type="checkbox"
            checked={listingPaymentEnabled}
            disabled={savingListingPayment}
            onChange={(e) => void toggleListingPayment(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>
            {t("pages.adminSettings.featureCards.listingPayment.toggle")}
          </span>
        </label>
      </div>

      {/* Server-persisted (SystemSetting: feature.feed_auto_publish). Off by
          default → new feed posts go to the moderation queue. Turning it on
          auto-publishes them without a redeploy. */}
      <div style={{ ...card, padding: "24px", maxWidth: "640px", marginBottom: "20px" }}>
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "16px",
            color: "var(--foreground)",
            marginBottom: "4px",
          }}
        >
          {t("pages.adminSettings.featureCards.feedAutoPublish.title")}
        </h4>
        <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminSettings.featureCards.feedAutoPublish.subtitle")}
        </p>
        <label
          className="flex items-center gap-[8px] cursor-pointer"
          style={{ height: 36, opacity: savingFeedAutoPublish ? 0.6 : 1 }}
        >
          <input
            type="checkbox"
            checked={feedAutoPublish}
            disabled={savingFeedAutoPublish}
            onChange={(e) => void toggleFeedAutoPublish(e.target.checked)}
            style={{ width: 18, height: 18, accentColor: "var(--accent)" }}
          />
          <span style={{ fontSize: "13px", color: "var(--foreground-70)", fontWeight: 500 }}>
            {t("pages.adminSettings.featureCards.feedAutoPublish.toggle")}
          </span>
        </label>
      </div>

      <div style={{ marginBottom: "20px" }}>
        <FooterContactsAdminCard cardStyle={card} />
      </div>

      <div style={{ ...card, padding: "24px", maxWidth: "640px" }}>
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "16px",
            color: "var(--foreground)",
            marginBottom: "16px",
          }}
        >
          {t("pages.adminSettings.platformTitle")}
        </h4>

        {loading ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>
            {t("pages.adminCommon.loading")}
          </p>
        ) : settings.length === 0 ? (
          <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>
            {t("pages.adminSettings.empty")}
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {groups.map(([group, rows]) => (
              <div key={group}>
                <div
                  style={{
                    fontSize: "11px",
                    fontWeight: 600,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    color: "var(--foreground-50)",
                    marginBottom: "10px",
                  }}
                >
                  {t(`pages.adminSettings.groups.${group}`, { defaultValue: group })}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {rows.map(renderSetting)}
                </div>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={save}
          disabled={saving || loading}
          style={{
            ...primaryBtn,
            height: "44px",
            padding: "0 32px",
            fontSize: "14px",
            marginTop: "20px",
            opacity: saving || loading ? 0.7 : 1,
          }}
        >
          {saving ? t("pages.adminSettings.saving") : t("pages.adminSettings.save")}
        </button>
      </div>
    </div>
  );
}
