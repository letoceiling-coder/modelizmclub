// Client-only settings persistence (per-device). Real backend sync is
// backend-track — see backend-endpoints-needed.md #24.

export type NotifKey = "friend_requests" | "comments" | "likes" | "messages" | "subscription_posts";
export type NotificationPrefs = Record<NotifKey, boolean>;

const NOTIF_KEY = "modelizm_notif_prefs";
const NOTIF_DEFAULTS: NotificationPrefs = {
  friend_requests: true,
  comments: true,
  likes: true,
  messages: true,
  subscription_posts: true,
};

export function getNotifPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return NOTIF_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(NOTIF_KEY);
    if (!raw) return NOTIF_DEFAULTS;
    return { ...NOTIF_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return NOTIF_DEFAULTS;
  }
}

export function setNotifPref(key: NotifKey, value: boolean): void {
  if (typeof window === "undefined") return;
  const next = { ...getNotifPrefs(), [key]: value };
  window.localStorage.setItem(NOTIF_KEY, JSON.stringify(next));
}

export interface Requisites {
  fullName: string;
  inn: string;
  phone: string;
  address: string;
}

const REQUISITES_KEY = "modelizm_requisites";
const REQUISITES_DEFAULTS: Requisites = { fullName: "", inn: "", phone: "", address: "" };

export function getRequisites(): Requisites {
  if (typeof window === "undefined") return REQUISITES_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(REQUISITES_KEY);
    if (!raw) return REQUISITES_DEFAULTS;
    return { ...REQUISITES_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return REQUISITES_DEFAULTS;
  }
}

export function setRequisites(r: Requisites): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(REQUISITES_KEY, JSON.stringify(r));
}
