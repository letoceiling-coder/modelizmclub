import { Icon, CategoryIcon, LandingCardIconSlot } from "@/components/ui/Icon";
import type { AdminIconSlotEntry } from "@/lib/icon-slots";
import { resolveLucideIcon } from "@/lib/lucide-icon";

interface Props {
  slot: AdminIconSlotEntry;
  label?: string;
  size?: number;
  /** Show built-in default only (ignore overrides) */
  forceDefault?: boolean;
}

/** Inline preview of how an icon slot renders on the site. */
export function IconSlotPreview({ slot, label, size = 20, forceDefault }: Props) {
  const previewLabel = label ?? slot.label;

  if (forceDefault) {
    if (slot.defaultImageUrl) {
      return (
        <img src={slot.defaultImageUrl} alt="" style={{ width: size, height: size, objectFit: "contain" }} />
      );
    }
    const Lucide = resolveLucideIcon(slot.defaultLucide);
    return <Lucide size={size} style={{ color: "var(--accent)" }} />;
  }

  if (slot.previewKind === "category" && slot.key.startsWith("category:")) {
    const id = slot.key.slice("category:".length);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ width: 36, height: 36, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--background-surface)" }}>
          <CategoryIcon categoryId={id} name={slot.defaultLucide} iconImageUrl={slot.defaultImageUrl} size={size} />
        </span>
        {previewLabel && <span style={{ fontSize: 14, fontWeight: 500, color: "var(--foreground)" }}>{previewLabel}</span>}
      </div>
    );
  }

  if (slot.previewKind === "landing" && slot.key.startsWith("landing.card:")) {
    const id = slot.key.slice("landing.card:".length);
    return (
      <div style={{ display: "flex", alignItems: "center", gap: 12, padding: 12, borderRadius: 12, border: "1px solid var(--border)", maxWidth: 280 }}>
        <LandingCardIconSlot cardId={id} icon={slot.defaultLucide} iconUrl={slot.defaultImageUrl} size={size + 4} />
        {previewLabel && (
          <div>
            <div style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{previewLabel}</div>
            <div style={{ fontSize: 11, color: "var(--foreground-50)" }}>Карточка на главной</div>
          </div>
        )}
      </div>
    );
  }

  if (slot.previewKind === "value") {
    return (
      <div style={{ display: "flex", alignItems: "flex-start", gap: 12, padding: 16, borderRadius: 12, border: "1px solid var(--border)", maxWidth: 280 }}>
        <span style={{ width: 44, height: 44, borderRadius: 10, display: "grid", placeItems: "center", background: "var(--accent-soft)" }}>
          <Icon slot={slot.key} size={size} />
        </span>
        {previewLabel && (
          <div>
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--foreground)" }}>{previewLabel}</div>
            <div style={{ fontSize: 12, color: "var(--foreground-70)", marginTop: 4 }}>Блок «Почему моделисты выбирают нас»</div>
          </div>
        )}
      </div>
    );
  }

  if (slot.previewKind === "faq") {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, padding: "12px 16px", borderRadius: 12, border: "1px solid var(--border)", maxWidth: 320 }}>
        <span style={{ fontSize: 14, fontWeight: 600, color: "var(--foreground)" }}>{previewLabel || "Вопрос FAQ"}</span>
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
