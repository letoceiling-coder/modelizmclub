import { useEffect, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { updateAdminSettings, fetchAdminSettings } from "@/lib/api/admin";
import { uploadAdminMedia } from "@/lib/api/admin-media";
import { BRANDING_SETTING_KEY, fetchSiteBranding } from "@/lib/api/site";
import { invalidateSiteBrandingCache } from "@/lib/hooks/useSiteBranding";

const inputStyle: CSSProperties = {
  height: "40px",
  background: "var(--background)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-input)",
  padding: "0 14px",
  fontSize: "13px",
  color: "var(--foreground)",
  width: "100%",
};

export function SiteBrandingAdminCard({ cardStyle }: { cardStyle: CSSProperties }) {
  const { t } = useTranslation();
  const [headerSize, setHeaderSize] = useState(48);
  const [footerSize, setFooterSize] = useState(36);
  const [headerUuid, setHeaderUuid] = useState<string | null>(null);
  const [footerUuid, setFooterUuid] = useState<string | null>(null);
  const [headerPreview, setHeaderPreview] = useState<string | null>(null);
  const [footerPreview, setFooterPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState<"header" | "footer" | null>(null);

  useEffect(() => {
    Promise.all([fetchSiteBranding(), fetchAdminSettings()])
      .then(([data, settings]) => {
        setHeaderPreview(data.logo_url ?? null);
        setFooterPreview(data.footer_logo_url ?? null);
        setHeaderSize(data.header_size ?? 48);
        setFooterSize(data.footer_size ?? 36);
        const row = settings.find((s) => s.key === BRANDING_SETTING_KEY);
        const v = row?.value as {
          header_media_uuid?: string | null;
          footer_media_uuid?: string | null;
        } | undefined;
        if (v?.header_media_uuid) setHeaderUuid(v.header_media_uuid);
        if (v?.footer_media_uuid) setFooterUuid(v.footer_media_uuid);
      })
      .catch(() => toast.error(t("pages.adminBranding.loadFailed")))
      .finally(() => setLoading(false));
  }, [t]);

  const uploadLogo = async (target: "header" | "footer", file: File) => {
    setUploading(target);
    try {
      const media = await uploadAdminMedia(file, "logo");
      if (target === "header") {
        setHeaderUuid(media.uuid);
        setHeaderPreview(media.url);
      } else {
        setFooterUuid(media.uuid);
        setFooterPreview(media.url);
      }
      toast.success(t("pages.adminBranding.uploaded"));
    } catch {
      toast.error(t("pages.adminBranding.uploadFailed"));
    } finally {
      setUploading(null);
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      await updateAdminSettings([
        {
          key: BRANDING_SETTING_KEY,
          value: {
            header_media_uuid: headerUuid,
            footer_media_uuid: footerUuid,
            header_size: headerSize,
            footer_size: footerSize,
          },
          group: "design",
        },
      ]);
      invalidateSiteBrandingCache();
      toast.success(t("pages.adminBranding.saved"));
    } catch {
      toast.error(t("pages.adminBranding.saveFailed"));
    } finally {
      setSaving(false);
    }
  };

  const renderSlot = (
    label: string,
    preview: string | null,
    target: "header" | "footer",
    size: number,
    onSize: (n: number) => void,
  ) => (
    <div style={{ display: "grid", gap: 10 }}>
      <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>{label}</span>
      <div
        style={{
          minHeight: 72,
          border: "1px dashed var(--border)",
          borderRadius: "var(--r-card-sm)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          padding: 12,
          background: "var(--background-surface)",
        }}
      >
        {preview ? (
          <img src={preview} width={Math.round(size * 1600 / 514)} height={size} loading="lazy" decoding="async" alt="" style={{ height: size, width: "auto", maxWidth: "100%", objectFit: "contain" }} />
        ) : (
          <span style={{ fontSize: 12, color: "var(--foreground-50)" }}>{t("pages.adminBranding.noLogo")}</span>
        )}
      </div>
      <label style={{ display: "inline-flex", width: "fit-content", cursor: "pointer" }}>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp,image/svg+xml"
          className="sr-only"
          disabled={uploading === target}
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void uploadLogo(target, file);
            e.target.value = "";
          }}
        />
        <span style={{ fontSize: 13, fontWeight: 600, color: "var(--accent)" }}>
          {uploading === target ? "…" : t("pages.adminBranding.upload")}
        </span>
      </label>
      <label style={{ display: "grid", gap: 4, maxWidth: 160 }}>
        <span style={{ fontSize: 11, color: "var(--foreground-50)" }}>{t("pages.adminBranding.sizeLabel")}</span>
        <input
          type="number"
          min={24}
          max={96}
          value={size}
          onChange={(e) => onSize(Math.max(24, Math.min(96, +e.target.value || size)))}
          style={inputStyle}
        />
      </label>
    </div>
  );

  return (
    <div style={{ ...cardStyle, padding: "24px", maxWidth: "720px" }}>
      <h4 style={{ fontFamily: "var(--font-display)", fontWeight: 600, fontSize: "16px", color: "var(--foreground)", marginBottom: "8px" }}>
        {t("pages.adminBranding.title")}
      </h4>
      <p style={{ fontSize: "12px", color: "var(--foreground-50)", marginBottom: "16px" }}>
        {t("pages.adminBranding.hint")}
      </p>

      {loading ? (
        <p style={{ fontSize: "13px", color: "var(--foreground-50)" }}>{t("pages.adminCommon.loading")}</p>
      ) : (
        <div style={{ display: "grid", gap: 20, gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))" }}>
          {renderSlot(t("pages.adminBranding.headerLogo"), headerPreview, "header", headerSize, setHeaderSize)}
          {renderSlot(t("pages.adminBranding.footerLogo"), footerPreview, "footer", footerSize, setFooterSize)}
        </div>
      )}

      <button
        type="button"
        onClick={save}
        disabled={saving || loading}
        className="mt-4 rounded-[var(--r-pill)] px-4 py-2 text-sm font-semibold text-[var(--accent-foreground)]"
        style={{ background: "var(--accent)", opacity: saving ? 0.7 : 1 }}
      >
        {saving ? "…" : t("pages.adminCommon.save")}
      </button>
    </div>
  );
}
