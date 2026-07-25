import { api } from "./client";

export type DenyMode = "inherit" | "popup" | "redirect";

export interface GuestAccessActionConfig {
  allowed: boolean;
  deny_mode: DenyMode;
}

export interface FeedGuestAccessConfig {
  version: number;
  default_deny_mode: "popup" | "redirect";
  popup: {
    title: string;
    description: string;
    primary_cta: string;
    secondary_cta: string;
  };
  actions: Record<string, GuestAccessActionConfig>;
}

export interface FeedGuestAccessRegistryItem {
  key: string;
  group: string;
  label: string;
  hint: string;
  default_allowed: boolean;
}

export interface AdminFeedGuestAccessPayload {
  config: FeedGuestAccessConfig;
  registry: FeedGuestAccessRegistryItem[];
  group_labels: Record<string, string>;
}

import { buildDefaultFeedGuestAccessConfig } from "@/lib/feed-guest-access/registry";

export async function fetchFeedGuestAccess(): Promise<FeedGuestAccessConfig> {
  const res = await api<{ data: FeedGuestAccessConfig }>("/public/feed-guest-access", { auth: false });
  return res.data ?? buildDefaultFeedGuestAccessConfig();
}

export async function fetchAdminFeedGuestAccess(): Promise<AdminFeedGuestAccessPayload> {
  const res = await api<{ data: AdminFeedGuestAccessPayload }>("/admin/feed/guest-access");
  return res.data;
}

export async function updateAdminFeedGuestAccess(config: FeedGuestAccessConfig): Promise<AdminFeedGuestAccessPayload> {
  const res = await api<{ data: AdminFeedGuestAccessPayload }>("/admin/feed/guest-access", { method: "PUT", json: config });
  return res.data;
}
