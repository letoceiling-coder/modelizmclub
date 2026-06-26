// Centralized accent theme manager — updates CSS variables globally.
// Persists to localStorage. Safe-by-default: does not touch app logic.

const STORAGE_KEY = "ds-theme-v1";

export type AccentSwatch = { id: string; label: string; hex: string; kind: "base" | "light" | "dark" };

export const BASE_ACCENTS: AccentSwatch[] = [
  { id: "orange",      label: "Orange",       hex: "#F26C05", kind: "base" },
  { id: "orange-hot",  label: "Hot Orange",   hex: "#FA4F02", kind: "base" },
  { id: "red-brown",   label: "Red Brown",    hex: "#A52814", kind: "base" },
  { id: "red-deep",    label: "Deep Red",     hex: "#A1001E", kind: "base" },
];

// --- color utils ---
function hexToRgb(hex: string) {
  const h = hex.replace("#", "");
  return { r: parseInt(h.slice(0,2),16), g: parseInt(h.slice(2,4),16), b: parseInt(h.slice(4,6),16) };
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

export function generateVariations(baseHex: string): AccentSwatch[] {
  const lighter = [0.12, 0.24, 0.36, 0.5, 0.65].map((a, i) => ({
    id: `light-${i+1}`, label: `+${Math.round(a*100)}%`, hex: mix(baseHex, "white", a), kind: "light" as const,
  }));
  const darker = [0.12, 0.24, 0.36, 0.5, 0.65].map((a, i) => ({
    id: `dark-${i+1}`, label: `-${Math.round(a*100)}%`, hex: mix(baseHex, "black", a), kind: "dark" as const,
  }));
  return [...lighter, ...darker];
}

export type Mode = "dark" | "light";
export type ThemeState = { mode: Mode; accent: string };

export function loadTheme(): ThemeState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const p = JSON.parse(raw);
    if (p && typeof p.accent === "string" && (p.mode === "dark" || p.mode === "light")) return p;
  } catch { /* ignore */ }
  return null;
}

export function saveTheme(state: ThemeState) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); } catch { /* ignore */ }
}

export function applyAccent(hex: string) {
  if (typeof document === "undefined") return;
  const root = document.documentElement;
  const hover = mix(hex, "white", 0.12);
  const muted = mix(hex, "black", 0.28);
  root.style.setProperty("--accent", hex);
  root.style.setProperty("--accent-hover", hover);
  root.style.setProperty("--accent-muted", muted);
  root.style.setProperty("--accent-soft", rgbaFrom(hex, 0.12));
  root.style.setProperty("--accent-glow", rgbaFrom(hex, 0.25));
  root.style.setProperty("--border-accent", rgbaFrom(hex, 0.40));
  root.style.setProperty("--danger", hex);
  root.style.setProperty("--danger-soft", rgbaFrom(hex, 0.15));
  root.style.setProperty("--error", hex);
  root.style.setProperty("--error-soft", rgbaFrom(hex, 0.15));
  root.style.setProperty("--shadow-button", `0 2px 8px ${rgbaFrom(hex, 0.30)}`);
  root.style.setProperty("--shadow-glow-accent", `0 0 24px ${rgbaFrom(hex, 0.25)}`);
  root.style.setProperty("--shadow-card-hover", `0 4px 24px ${rgbaFrom(hex, 0.15)}`);
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
  applyAccent(state.accent);
  saveTheme(state);
}

export function bootstrapTheme() {
  const saved = loadTheme();
  if (saved) applyTheme(saved);
}
