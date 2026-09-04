import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import {
  getNotifPrefs as getLocalNotifPrefs,
  setAllNotifPrefs as setLocalNotifPrefs,
  NOTIF_DEFAULTS,
  type NotificationPrefs,
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

export interface CabinetNotifItem {
  key: string;
  group: string;
  label: string;
  hint: string;
  min_tier: "registered" | "verified" | "subscriber";
  user_can_toggle: boolean;
  can_toggle: boolean;
  locked: boolean;
  meets_tier: boolean;
  enabled: boolean;
  channels: string[];
}

export type NotifPrefsState = {
  prefs: NotificationPrefs;
  items: CabinetNotifItem[];
  groupLabels: Record<string, string>;
  userTier: string;
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

function demoItems(prefs: NotificationPrefs): CabinetNotifItem[] {
  const rows: { key: keyof NotificationPrefs; label: string; hint: string }[] = [
    { key: "friend_requests", label: "Заявки в друзья", hint: "" },
    { key: "comments", label: "Комментарии", hint: "" },
    { key: "likes", label: "Лайки", hint: "" },
    { key: "messages", label: "Сообщения", hint: "" },
    { key: "subscription_posts", label: "Посты в подписках", hint: "" },
  ];
  return rows.map((row) => ({
    key: row.key,
    group: "social",
    label: row.label,
    hint: row.hint,
    min_tier: "registered",
    user_can_toggle: true,
    can_toggle: true,
    locked: false,
    meets_tier: true,
    enabled: prefs[row.key],
    channels: ["in_app", "max"],
  }));
}

function parsePayload(raw: unknown): {
  prefs: ApiPref[];
  items: CabinetNotifItem[];
  groupLabels: Record<string, string>;
  userTier: string;
  maxEnabled: boolean;
} {
  const data = raw as
    | {
        preferences?: ApiPref[];
        items?: CabinetNotifItem[];
        group_labels?: Record<string, string>;
        user_tier?: string;
        max_enabled?: boolean;
      }
    | ApiPref[]
    | null;

  if (Array.isArray(data)) {
    return { prefs: data, items: [], groupLabels: {}, userTier: "registered", maxEnabled: true };
  }

  return {
    prefs: data?.preferences ?? [],
    items: data?.items ?? [],
    groupLabels: data?.group_labels ?? {},
    userTier: data?.user_tier ?? "registered",
    maxEnabled: data?.max_enabled ?? true,
  };
}

export async function fetchNotifPrefs(): Promise<NotifPrefsState> {
  if (isDemoMode()) {
    const prefs = getLocalNotifPrefs();
    return {
      prefs,
      items: demoItems(prefs),
      groupLabels: { social: "Социальные" },
      userTier: "verified",
      maxEnabled: getDemoMaxEnabled(),
    };
  }

  const res = await api<{ data: unknown }>("/users/me/settings");
  const parsed = parsePayload(res.data);
  const prefs: NotificationPrefs = { ...NOTIF_DEFAULTS };
  let maxEnabled = parsed.maxEnabled;
  for (const row of parsed.prefs) {
    if (row.channel === CHANNEL && row.type in prefs) {
      prefs[row.type as keyof NotificationPrefs] = row.enabled;
    }
    if (row.channel === MAX_CHANNEL && row.type === MAX_MASTER_TYPE) {
      maxEnabled = row.enabled;
    }
  }
  for (const item of parsed.items) {
    if (item.key in prefs) {
      prefs[item.key as keyof NotificationPrefs] = item.enabled;
    }
  }
  return {
    prefs,
    items: parsed.items,
    groupLabels: parsed.groupLabels,
    userTier: parsed.userTier,
    maxEnabled,
  };
}

export async function saveNotifPref(key: string, enabled: boolean): Promise<void> {
  if (isDemoMode()) {
    if (key in NOTIF_DEFAULTS) {
      setLocalNotifPrefs({ ...getLocalNotifPrefs(), [key]: enabled } as NotificationPrefs);
    }
    return;
  }
  await api("/users/me/settings", {
    method: "PATCH",
    json: {
      preferences: [{ channel: CHANNEL, type: key, enabled }],
    },
  });
}

export async function saveNotifPrefs(prefs: NotificationPrefs): Promise<void> {
  if (isDemoMode()) {
    setLocalNotifPrefs(prefs);
    return;
  }
  await api("/users/me/settings", {
    method: "PATCH",
    json: {
      preferences: (Object.keys(prefs) as (keyof NotificationPrefs)[]).map((key) => ({
        channel: CHANNEL,
        type: key,
        enabled: prefs[key],
      })),
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
