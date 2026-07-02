// Brand accent presets — the two managed accent identities for МоДелизМ.
//
// The client wants exactly two brand-controlled accents (Blue / Menthol), not a
// free-form RGB picker. Each preset is a full token map applied to CSS variables
// by theme-manager. Orange lives separately as --accent-commercial (promo only)
// and is intentionally NOT selectable here.

export type AccentPresetId = "blue" | "menthol";

export interface AccentPreset {
  id: AccentPresetId;
  label: string;
  /** primary accent — CTAs, active states, links, focus */
  primary: string;
  hover: string;
  active: string;
  /** rgba tints */
  soft: string;
  glow: string;
  borderAccent: string;
  /** text/icon color that sits ON an accent fill (contrast-picked per preset) */
  foreground: string;
}

export const DEFAULT_ACCENT_ID: AccentPresetId = "blue";

export const ACCENT_PRESETS: Record<AccentPresetId, AccentPreset> = {
  blue: {
    id: "blue",
    label: "Blue",
    primary: "#627FFF",
    hover: "#4F66E8",
    active: "#3F4FBF",
    soft: "rgba(98, 127, 255, 0.14)",
    glow: "rgba(98, 127, 255, 0.28)",
    borderAccent: "rgba(98, 127, 255, 0.40)",
    // white reads well on the blue fill
    foreground: "#FFFFFF",
  },
  menthol: {
    id: "menthol",
    label: "Menthol",
    primary: "#69C6AB",
    hover: "#55B79C",
    active: "#3F9B85",
    soft: "rgba(105, 198, 171, 0.14)",
    glow: "rgba(105, 198, 171, 0.28)",
    borderAccent: "rgba(105, 198, 171, 0.40)",
    // menthol is light — dark ink keeps CTA text readable (white would fail contrast)
    foreground: "#0F1519",
  },
};

export const ACCENT_PRESET_LIST: AccentPreset[] = [ACCENT_PRESETS.blue, ACCENT_PRESETS.menthol];

export function isAccentPresetId(v: unknown): v is AccentPresetId {
  return v === "blue" || v === "menthol";
}

export function getAccentPreset(id: string | null | undefined): AccentPreset {
  return isAccentPresetId(id) ? ACCENT_PRESETS[id] : ACCENT_PRESETS[DEFAULT_ACCENT_ID];
}
