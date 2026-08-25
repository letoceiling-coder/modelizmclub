import { api } from "./client";

export type NotificationPolicyTier = "registered" | "verified" | "subscriber";
export type NotificationPolicyChannel = "in_app" | "max";

export interface NotificationPolicyTypeConfig {
  enabled: boolean;
  min_tier: NotificationPolicyTier;
  user_can_toggle: boolean;
  default_enabled: boolean;
  channels: NotificationPolicyChannel[];
}

export interface NotificationPolicyConfig {
  version: number;
  types: Record<string, NotificationPolicyTypeConfig>;
}

export interface NotificationPolicyRegistryItem {
  key: string;
  group: string;
  label: string;
  hint: string;
  default_min_tier: NotificationPolicyTier;
  default_enabled: boolean;
  default_user_can_toggle: boolean;
  default_channels: NotificationPolicyChannel[];
  show_in_cabinet: boolean;
}

export interface AdminNotificationPolicyPayload {
  config: NotificationPolicyConfig;
  registry: NotificationPolicyRegistryItem[];
  group_labels: Record<string, string>;
}

export async function fetchAdminNotificationPolicy(): Promise<AdminNotificationPolicyPayload> {
  const res = await api<{ data: AdminNotificationPolicyPayload }>("/admin/notifications/policy");
  return res.data;
}

export async function updateAdminNotificationPolicy(
  config: NotificationPolicyConfig,
): Promise<AdminNotificationPolicyPayload> {
  const res = await api<{ data: AdminNotificationPolicyPayload }>("/admin/notifications/policy", {
    method: "PUT",
    json: config,
  });
  return res.data;
}
