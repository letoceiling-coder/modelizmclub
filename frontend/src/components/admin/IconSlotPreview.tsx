import { Icon, CategoryIcon, LandingCardIconSlot, IconBox } from "@/components/ui/Icon";
import type { AdminIconSlotEntry } from "@/lib/icon-slots";
import { resolveLucideIcon } from "@/lib/lucide-icon";
import { useTranslation } from "react-i18next";

interface Props {
  slot: AdminIconSlotEntry;
  label?: string;
  size?: number;
  /** Show built-in default only (ignore overrides) */
  forceDefault?: boolean;
}

/** Inline preview of how an icon slot renders on the site. */
export function IconSlotPreview({ slot, label, size = 20, forceDefault }: Props) {
  const { t } = useTranslation();
  const previewLabel = label ?? slot.label;

  if (forceDefault) {
    if (slot.defaultImageUrl) {
      return (
        <IconBox size="lg" variant="accent-soft">
          <img src={slot.defaultImageUrl} alt="" className="icon-box__content" style={{ objectFit: "contain" }} />
        </IconBox>
      );
    }
    const Lucide = resolveLucideIcon(slot.defaultLucide);
    return (
      <IconBox size="lg" variant="accent-soft">
        <Lucide className="icon-box__content" style={{ color: "var(--accent)" }} />
      </IconBox>
    );
  }

  if (slot.previewKind === "category" && slot.key.startsWith("category:")) {
    const id = slot.key.slice("category:".length);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <IconBox size="md" variant="surface">
          <CategoryIcon categoryId={id} name={slot.defaultLucide} iconImageUrl={slot.defaultImageUrl} fill />
        </IconBox>
        {previewLabel && <span style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{previewLabel}</span>}
      </div>
    );
  }

  if (slot.previewKind === "landing" && slot.key.startsWith("landing.card:")) {
    const id = slot.key.slice("landing.card:".length);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, border: "1px solid var(--border)", maxWidth: 280 }}>
        <IconBox size="xl" variant="accent-soft">
          <LandingCardIconSlot cardId={id} icon={slot.defaultLucide} iconUrl={slot.defaultImageUrl} fill />
        </IconBox>
        {previewLabel && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{previewLabel}</div>
            <div style={{ fontSize: 11, color: "var(--foreground-50)" }}>{t("pages.adminIcons.preview.landingCard")}</div>
          </div>
        )}
      </div>
    );
  }

  if (slot.previewKind === "value") {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 16, borderRadius: 12, border: "1px solid var(--border)", maxWidth: 280 }}>
        <IconBox size="lg" variant="accent-soft">
          <Icon slot={slot.key} fill />
        </IconBox>
        {previewLabel && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{previewLabel}</div>
            <div style={{ fontSize: 12, color: "var(--foreground-70)", marginTop: 4 }}>{t("pages.adminIcons.preview.valueBlock")}</div>
          </div>
        )}
      </div>
    );
  }

  if (slot.previewKind === "faq") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", maxWidth: 320 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{previewLabel || t("pages.adminIcons.preview.faqQuestion")}</span>
        <span style={{ width: 28, height: 28, borderRadius: 8, display: "grid", placeItems: "center", border: "1px solid var(--border)", background: "var(--background-surface)" }}>
          <Icon slot={slot.key} size={14} inheritColor />
        </span>
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 10, border: "1px solid var(--border)", maxWidth: 260, background: "var(--background-surface)" }}>
      <Icon slot={slot.key} size={size} inheritColor />
      {previewLabel && <span style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{previewLabel}</span>}
    </div>
  );
}
