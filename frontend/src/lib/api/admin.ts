import { apiRequest } from "./client";
import { getAuthToken } from "./auth";

function token() {
  return getAuthToken();
}

export type AdminStats = {
  users_total: number;
  posts_total: number;
  communities_total: number;
  moderation_pending: number;
  reports_pending: number;
  plans_active: number;
  promocodes_active: number;
  banners_active: number;
};

export async function fetchAdminDashboard(): Promise<AdminStats> {
  const res = await apiRequest<{ data: AdminStats }>("/admin/dashboard", { token: token() });
  return res.data;
}

export type ModerationItem = {
  id: number;
  queue: string;
  status: string;
  moderatable_type: string;
  moderatable_id: number;
  moderatable?: { uuid?: string; title?: string; name?: string; body?: string } | null;
  created_at: string | null;
};

export async function fetchModerationQueue(status = "pending"): Promise<ModerationItem[]> {
  const qs = new URLSearchParams({ status, per_page: "50" });
  const res = await apiRequest<{ data: ModerationItem[] }>(`/admin/moderation/queue?${qs.toString()}`, { token: token() });
  return res.data ?? [];
}

export async function approveModeration(type: string, uuid: string): Promise<void> {
  await apiRequest(`/admin/moderation/${type}/${uuid}/approve`, { method: "POST", token: token() });
}

export async function rejectModeration(type: string, uuid: string, reason?: string): Promise<void> {
  await apiRequest(`/admin/moderation/${type}/${uuid}/reject`, {
    method: "POST",
    token: token(),
    json: { reason: reason ?? "Отклонено модератором" },
  });
}

export type AdminUser = {
  uuid: string;
  email: string;
  name: string | null;
  role: string;
  status: string;
  profile?: { display_name: string | null; slug: string | null } | null;
  created_at: string | null;
};

export async function fetchAdminUsers(params?: { role?: string; status?: string }): Promise<AdminUser[]> {
  const qs = new URLSearchParams({ per_page: "50" });
  if (params?.role) qs.set("role", params.role);
  if (params?.status) qs.set("status", params.status);
  const res = await apiRequest<{ data: AdminUser[] }>(`/admin/users?${qs.toString()}`, { token: token() });
  return res.data ?? [];
}

export async function updateAdminUser(uuid: string, data: Partial<{ role: string; status: string; name: string }>): Promise<void> {
  await apiRequest(`/admin/users/${uuid}`, { method: "PATCH", token: token(), json: data });
}

export type AdminBanner = {
  id: number;
  placement: string;
  title: string;
  text?: string | null;
  link_url?: string | null;
  is_active: boolean;
};

export async function fetchAdminBanners(): Promise<AdminBanner[]> {
  const res = await apiRequest<{ data: { data: AdminBanner[] } }>("/admin/banners", { token: token() });
  return res.data?.data ?? [];
}

export async function createBanner(input: { placement: string; title: string; text?: string; link_url?: string; is_active?: boolean }): Promise<void> {
  await apiRequest("/admin/banners", { method: "POST", token: token(), json: input });
}

export async function updateBanner(id: number, input: Partial<{ placement: string; title: string; text: string; link_url: string; is_active: boolean }>): Promise<void> {
  await apiRequest(`/admin/banners/${id}`, { method: "PATCH", token: token(), json: input });
}

export async function deleteBanner(id: number): Promise<void> {
  await apiRequest(`/admin/banners/${id}`, { method: "DELETE", token: token() });
}

export type SystemSettingRow = {
  key: string;
  value: unknown;
  group: string;
};

export async function fetchAdminSettings(): Promise<SystemSettingRow[]> {
  const res = await apiRequest<{ data: SystemSettingRow[] }>("/admin/settings", { token: token() });
  return res.data ?? [];
}

export async function updateAdminSettings(settings: SystemSettingRow[]): Promise<void> {
  await apiRequest("/admin/settings", { method: "PATCH", token: token(), json: { settings } });
}
