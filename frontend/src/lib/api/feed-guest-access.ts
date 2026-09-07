import { api } from "./client";

export type DenyMode = "inherit" | "popup" | "redirect";
export type AccessTier = "guest" | "auth" | "subscription";

export interface GuestAccessActionConfig {
  allowed: boolean;
  min_tier: AccessTier;
  deny_mode: DenyMode;
}

export interface FeedGuestAccessConfig {
  version: number;
  default_deny_mode: "popup" | "redirect";
  /*
   * Поля `popup` здесь больше нет.
   *
   * Оно существовало в контракте и в базе, но не рендерилось нигде: тексты
   * окон доступа берутся из i18n (`gate.auth.*`, `gate.verify.*`,
   * `gate.paywall.*`), а из этой конфигурации читается только `deny_mode`.
   * На проде в нём с августа лежало «Нужна подписка» / «Оформить подписку» —
   * восемь правок одного администратора, ни одна из которых ничего не
   * изменила. Настройка, которая ничего не меняет, хуже её отсутствия: она
   * выглядит как рычаг и тратит время того, кто его дёргает.
   *
   * Строка в system_settings осталась и безвредна, пока её никто не читает.
   * Если тексты окон когда-нибудь понадобится задавать из админки — делать
   * это надо там же, где живут остальные, а не воскрешать это поле.
   */
  actions: Record<string, GuestAccessActionConfig>;
}

export interface FeedGuestAccessRegistryItem {
  key: string;
  group: string;
  label: string;
  hint: string;
  default_allowed: boolean;
  default_min_tier: AccessTier;
}

export interface AdminFeedGuestAccessPayload {
  config: FeedGuestAccessConfig;
  registry: FeedGuestAccessRegistryItem[];
  group_labels: Record<string, string>;
}

import { buildDefaultFeedGuestAccessConfig } from "@/lib/feed-guest-access/registry";

export async function fetchFeedGuestAccess(): Promise<FeedGuestAccessConfig> {
  const res = await api<{ data: FeedGuestAccessConfig }>("/public/feed-guest-access", {
    auth: false,
  });
  return res.data ?? buildDefaultFeedGuestAccessConfig();
}

export async function fetchAdminFeedGuestAccess(): Promise<AdminFeedGuestAccessPayload> {
  const res = await api<{ data: AdminFeedGuestAccessPayload }>("/admin/feed/guest-access");
  return res.data;
}

export async function updateAdminFeedGuestAccess(
  config: FeedGuestAccessConfig,
): Promise<AdminFeedGuestAccessPayload> {
  const res = await api<{ data: AdminFeedGuestAccessPayload }>("/admin/feed/guest-access", {
    method: "PUT",
    json: config,
  });
  return res.data;
}
