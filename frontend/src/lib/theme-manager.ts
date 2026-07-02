// Centralized accent theme manager — updates CSS variables globally.
// Persists to localStorage. Safe-by-default: does not touch app logic.
//
// The primary user scenario is choosing one of two BRAND presets (blue / menthol)
// — see src/lib/theme/accent-presets.ts. An advanced free-form hex path is kept
// for admin/debug only. On production this is a frontend-only setting stored in
// localStorage; a backend "global design settings" endpoint can later feed the
// same applyAccentPreset() call (see TODO in applyTheme).

import {
  ACCENT_PRESETS,
  ACCENT_PRESET_LIST,
  DEFAULT_ACCENT_ID,
  getAccentPreset,
  isAccentPresetId,
  type AccentPreset,
  type AccentPresetId,
} from "@/lib/theme/accent-presets";

const STORAGE_KEY = "ds-theme-v1";

export type { AccentPreset, AccentPresetId };
export { ACCENT_PRESETS, ACCENT_PRESET_LIST, DEFAULT_ACCENT_ID, getAccentPreset, isAccentPresetId };

// Kept for the admin swatch grid — now the two brand presets, not orange/red.
export type AccentSwatch = { id: string; label: string; hex: string; kind: "base" | "light" | "dark" };
export const BASE_ACCENTS: AccentSwatch[] = ACCENT_PRESET_LIST.map((p) => ({
  id: p.id,
  label: p.label,
  hex: p.primary,
  kind: "base",
}));

// --- color utils (used by the advanced/debug hex path) ---
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0, 2), 16), g: parseInt(h.slice(2, 4), 16), b: parseInt(h.slice(4, 6), 16) };
}
function rgbToHex(r: number, g: number, b: number) {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, "0");
  return `#${c(r)}${c(g)}${c(b)}`.toUpperCase();
}
function mix(hex: string, target: "white" | "black", amount: number) {
  const { r, g, b } = hexToRgb(hex);
  const t = target === "white" ? 255 : 0;
  return rgbToHex(r + (t - r) * amount, g + (t - g) * amount, b + (t - b) * amount);
}
function rgbaFrom(hex: string, alpha: number) {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
/** Relative luminance → pick readable ink for text on a colored fill. */
function readableForeground(hex: string): string {
  const { r, g, b } = hexToRgb(hex);
  const lin = (c: number) => { const s = c / 255; return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b);
  return L > 0.45 ? "#0F1519" : "#FFFFFF";
}

export function generateVariations(baseHex: string): AccentSwatch[] {
  const lighter = [0.12, 0.24, 0.36, 0.5, 0.65].map((a, i) => ({
    id: `light-${i + 1}`, label: `+${Math.round(a * 100)}%`, hex: mix(baseHex, "white", a), kind: "light" as const,
  }));
  const darker = [0.12, 0.24, 0.36, 0.5, 0.65].map((a, i) => ({
    id: `dark-${i + 1}`, label: `-${Math.round(a * 100)}%`, hex: mix(baseHex, "black", a), kind: "dark" as const,
  }));
  return [...lighter, ...darker];
}

export type Mode = "dark" | "light";
// `accent` is a preset id ("blue"/"menthol") for the normal path, or a raw
// #RRGGBB for the advanced/debug path.
export type ThemeState = { mode: Mode; accent: string };

export function loadTheme(): ThemeState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.accent === "string" && (p.mode === "dark" || p.mode === "light")) {
      // migrate legacy hard-coded accents (old orange/red hexes) → default preset
      if (!isAccentPresetId(p.accent) && !/^#[0-9a-fA-F]{6}$/.test(p.accent)) {
        return { mode: p.mode, accent: DEFAULT_ACCENT_ID };
      }
      return p;
    }
  } catch { /* ignore */ }
  return null;
}

export function saveTheme(state: ThemeState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

/** Apply the full token set for a raw hex (advanced/debug path). */
export function applyAccent(hex: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const hover = mix(hex, "white", 0.12);
  const active = mix(hex, "black", 0.20);
  const fg = readableForeground(hex);
  root.style.setProperty("--accent", hex);
  root.style.setProperty("--accent-hover", hover);
  root.style.setProperty("--accent-active", active);
  root.style.setProperty("--accent-muted", active); // back-compat alias
  root.style.setProperty("--accent-foreground", fg);
  root.style.setProperty("--accent-soft", rgbaFrom(hex, 0.14));
  root.style.setProperty("--accent-glow", rgbaFrom(hex, 0.28));
  root.style.setProperty("--border-accent", rgbaFrom(hex, 0.40));
  root.style.setProperty("--focus-ring", hex);
  root.style.setProperty("--shadow-button", `0 2px 8px ${rgbaFrom(hex, 0.30)}`);
  root.style.setProperty("--shadow-glow-accent", `0 0 24px ${rgbaFrom(hex, 0.28)}`);
  root.style.setProperty("--shadow-card-hover", `0 4px 24px ${rgbaFrom(hex, 0.15)}`);
  root.removeAttribute("data-accent");
  // NOTE: intentionally does NOT touch --danger/--error/--success — semantic
  // colors must stay stable regardless of the chosen accent.
}

/** Apply a brand preset — the normal path. Sets data-accent + all tokens. */
export function applyAccentPreset(id: AccentPresetId) {
  if (typeof document === "undefined") return;
  const p = ACCENT_PRESETS[id];
  const root = document.documentElement;
  root.setAttribute("data-accent", id);
  root.style.setProperty("--accent", p.primary);
  root.style.setProperty("--accent-hover", p.hover);
  root.style.setProperty("--accent-active", p.active);
  root.style.setProperty("--accent-muted", p.active); // back-compat alias
  root.style.setProperty("--accent-foreground", p.foreground);
  root.style.setProperty("--accent-soft", p.soft);
  root.style.setProperty("--accent-glow", p.glow);
  root.style.setProperty("--border-accent", p.borderAccent);
  root.style.setProperty("--focus-ring", p.primary);
  root.style.setProperty("--shadow-button", `0 2px 8px ${p.glow}`);
  root.style.setProperty("--shadow-glow-accent", `0 0 24px ${p.glow}`);
  root.style.setProperty("--shadow-card-hover", `0 4px 24px ${p.soft}`);
}

export function applyMode(mode: Mode) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  root.setAttribute("data-theme", mode);
  root.classList.toggle("dark", mode === "dark");
  try { localStorage.setItem("theme", mode); } catch { /* ignore */ }
}

export function applyTheme(state: ThemeState) {
  applyMode(state.mode);
  if (isAccentPresetId(state.accent)) applyAccentPreset(state.accent);
  else applyAccent(state.accent); // advanced/debug hex
  saveTheme(state);
  // TODO(backend): when a global "design settings" endpoint exists, POST the
  // chosen preset id here so every user gets the brand-selected accent.
}

export function bootstrapTheme() {
  const saved = loadTheme();
  if (saved) applyTheme(saved);
  // No saved choice → CSS :root defaults already provide the blue preset tokens.
}
