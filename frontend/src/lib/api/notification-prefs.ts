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

const CHANNEL = "in_app";
const MAX_CHANNEL = "max";
const MAX_MASTER_TYPE = "all";
const DEMO_MAX_KEY = "modelizm_max_channel";

interface ApiPref {
  channel: string;
  type: string;
  enabled: boolean;
}

export type NotifPrefsState = {
  prefs: NotificationPrefs;
  maxEnabled: boolean;
};

function getDemoMaxEnabled(): boolean {
  if (typeof window === "undefined") return true;
  try {
    const raw = window.localStorage.getItem(DEMO_MAX_KEY);
    if (raw === "0") return false;
    return true;
  } catch {
    return true;
  }
}

export async function fetchNotifPrefs(): Promise<NotifPrefsState> {
  if (isDemoMode()) {
    return { prefs: getLocalNotifPrefs(), maxEnabled: getDemoMaxEnabled() };
  }

  const res = await api<{ data: ApiPref[] }>("/users/me/settings");
  const prefs: NotificationPrefs = { ...NOTIF_DEFAULTS };
  let maxEnabled = true;
  for (const row of res.data ?? []) {
    if (row.channel === CHANNEL && (NOTIF_KEYS as string[]).includes(row.type)) {
      prefs[row.type as NotifKey] = row.enabled;
    }
    if (row.channel === MAX_CHANNEL && row.type === MAX_MASTER_TYPE) {
      maxEnabled = row.enabled;
    }
  }
  return { prefs, maxEnabled };
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

export async function saveMaxChannelPref(enabled: boolean): Promise<void> {
  if (isDemoMode()) {
    try {
      window.localStorage.setItem(DEMO_MAX_KEY, enabled ? "1" : "0");
    } catch {
      /* ignore */
    }
    return;
  }
  await api("/users/me/settings", {
    method: "PATCH",
    json: {
      preferences: [{ channel: MAX_CHANNEL, type: MAX_MASTER_TYPE, enabled }],
    },
  });
}
