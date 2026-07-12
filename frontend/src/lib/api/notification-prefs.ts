import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import {
  getNotifPrefs as getLocalNotifPrefs,
  setAllNotifPrefs as setLocalNotifPrefs,
  NOTIF_KEYS,
  NOTIF_DEFAULTS,
  type NotificationPrefs,
  type NotifKey,
} from "@/lib/settings-prefs";

/**
 * Notification preferences persistence (Stage 4 — off localStorage onto the
 * real backend). The frontend UI is a flat 5-toggle list; the backend stores
 * per-(channel, type) rows { channel, type, enabled } via GET/PATCH
 * /users/me/settings. We namespace all of these toggles under a single
 * channel and map type ⇄ NotifKey 1:1. See docs/backend-endpoints-needed.md.
 *
 * Demo hosts (neeklo/local) have no backend — they fall back to localStorage
 * so the section still persists across refresh in demo.
 */
const CHANNEL = "in_app";

interface ApiPref {
  channel: string;
  type: string;
  enabled: boolean;
}

export async function fetchNotifPrefs(): Promise<NotificationPrefs> {
  if (isDemoMode()) return getLocalNotifPrefs();

  const res = await api<{ data: ApiPref[] }>("/users/me/settings");
  const prefs: NotificationPrefs = { ...NOTIF_DEFAULTS };
  for (const row of res.data ?? []) {
    if (row.channel !== CHANNEL) continue;
    if ((NOTIF_KEYS as string[]).includes(row.type)) {
      prefs[row.type as NotifKey] = row.enabled;
    }
  }
  return prefs;
}

export async function saveNotifPrefs(prefs: NotificationPrefs): Promise<void> {
  if (isDemoMode()) {
    setLocalNotifPrefs(prefs);
    return;
  }
  await api("/users/me/settings", {
    method: "PATCH",
    json: {
      preferences: NOTIF_KEYS.map((key) => ({ channel: CHANNEL, type: key, enabled: prefs[key] })),
    },
  });
}
