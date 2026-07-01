// Controlled DEMO MODE.
//
// Demo mode lets the public test stand (neeklo.modelizmclub.ru), local dev, or
// an explicit env/localStorage flag run the entire product on mock data —
// no backend, no auth, no CORS spam. Production (api.modelizmclub.ru) is never
// affected: none of the enabling conditions match there.
//
// Enabled when ANY of:
//   - import.meta.env.VITE_DEMO_MODE === "true"
//   - hostname contains "neeklo.modelizmclub.ru"
//   - hostname is localhost / 127.0.0.1 (local dev)
//   - localStorage "modelizm_demo_mode" === "1"
//
// Force-disabled (wins over everything) when:
//   - import.meta.env.VITE_DEMO_MODE === "false"
//   - localStorage "modelizm_demo_mode" === "0"

const LS_KEY = "modelizm_demo_mode";

function envFlag(): "on" | "off" | "unset" {
  const env = (import.meta as { env?: Record<string, string | undefined> }).env;
  const v = env?.VITE_DEMO_MODE;
  if (v === "true") return "on";
  if (v === "false") return "off";
  return "unset";
}

/**
 * True when the app should serve mock/demo data instead of hitting the API.
 * Safe on the server (returns the env-based answer only; host/localStorage
 * checks are client-only).
 */
export function isDemoMode(): boolean {
  const env = envFlag();
  if (env === "off") return false;
  if (env === "on") return true;

  if (typeof window === "undefined") return false;

  try {
    const ls = window.localStorage.getItem(LS_KEY);
    if (ls === "0") return false;
    if (ls === "1") return true;
  } catch {
    /* ignore */
  }

  const host = window.location.hostname;
  if (host.includes("neeklo.modelizmclub.ru")) return true;
  if (host === "localhost" || host === "127.0.0.1" || host === "0.0.0.0") return true;

  return false;
}

/** Manually turn demo mode on/off for the current browser (persists in localStorage). */
export function setDemoModeOverride(on: boolean | null): void {
  if (typeof window === "undefined") return;
  try {
    if (on === null) window.localStorage.removeItem(LS_KEY);
    else window.localStorage.setItem(LS_KEY, on ? "1" : "0");
  } catch {
    /* ignore */
  }
}
