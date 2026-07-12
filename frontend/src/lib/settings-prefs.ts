// Client-only settings persistence (per-device). Real backend sync is
// backend-track — see backend-endpoints-needed.md #24.

export type NotifKey = "friend_requests" | "comments" | "likes" | "messages" | "subscription_posts";
export type NotificationPrefs = Record<NotifKey, boolean>;

export const NOTIF_KEYS: NotifKey[] = ["friend_requests", "comments", "likes", "messages", "subscription_posts"];

const NOTIF_KEY = "modelizm_notif_prefs";
export const NOTIF_DEFAULTS: NotificationPrefs = {
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

/** Persist the whole set at once — used as the demo-mode backend by
 *  api/notification-prefs.ts (real backend uses /users/me/settings). */
export function setAllNotifPrefs(prefs: NotificationPrefs): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(NOTIF_KEY, JSON.stringify(prefs));
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

/** Payout method — separate from the legal Requisites above (documents vs.
 *  where money is sent). Manual-transfer model: no escrow/marketplace API,
 *  an admin reads this and sends money by hand. See backend-endpoints-needed.md
 *  §"Реквизиты выплат". Demo-only storage — real mode always round-trips the
 *  card number through the server, never persists it to localStorage. */
export interface PayoutRequisites {
  cardNumber: string;
}

const PAYOUT_REQUISITES_KEY = "modelizm_payout_requisites";
const PAYOUT_REQUISITES_DEFAULTS: PayoutRequisites = { cardNumber: "" };

export function getPayoutRequisites(): PayoutRequisites {
  if (typeof window === "undefined") return PAYOUT_REQUISITES_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(PAYOUT_REQUISITES_KEY);
    if (!raw) return PAYOUT_REQUISITES_DEFAULTS;
    return { ...PAYOUT_REQUISITES_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return PAYOUT_REQUISITES_DEFAULTS;
  }
}

export function setPayoutRequisites(r: PayoutRequisites): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PAYOUT_REQUISITES_KEY, JSON.stringify(r));
}

export interface AccountExtra {
  phone: string;
  vk: string;
  telegram: string;
  website: string;
  /** Locally-changed email (demo). Undefined → fall back to the account email. */
  email?: string;
  /** false right after a local email change → shows "Не подтверждён". */
  emailVerified?: boolean;
}

const ACCOUNT_EXTRA_KEY = "modelizm_account_extra";
const ACCOUNT_EXTRA_DEFAULTS: AccountExtra = { phone: "", vk: "", telegram: "", website: "" };

export function getAccountExtra(): AccountExtra {
  if (typeof window === "undefined") return ACCOUNT_EXTRA_DEFAULTS;
  try {
    const raw = window.localStorage.getItem(ACCOUNT_EXTRA_KEY);
    if (!raw) return ACCOUNT_EXTRA_DEFAULTS;
    return { ...ACCOUNT_EXTRA_DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return ACCOUNT_EXTRA_DEFAULTS;
  }
}

export function setAccountExtra(v: AccountExtra): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCOUNT_EXTRA_KEY, JSON.stringify(v));
}
