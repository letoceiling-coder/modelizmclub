import { api } from "./client";

interface Paginated<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

export interface AdminDashboard {
  usersTotal: number;
  postsTotal: number;
  communitiesTotal: number;
  moderationPending: number;
  reportsPending: number;
  plansActive: number;
  promocodesActive: number;
  bannersActive: number;
}

interface ApiDashboard {
  users_total?: number;
  posts_total?: number;
  communities_total?: number;
  moderation_pending?: number;
  reports_pending?: number;
  plans_active?: number;
  promocodes_active?: number;
  banners_active?: number;
}

export async function fetchDashboard(): Promise<AdminDashboard> {
  const res = await api<{ data: ApiDashboard }>("/admin/dashboard");
  const d = res.data ?? {};
  return {
    usersTotal: d.users_total ?? 0,
    postsTotal: d.posts_total ?? 0,
    communitiesTotal: d.communities_total ?? 0,
    moderationPending: d.moderation_pending ?? 0,
    reportsPending: d.reports_pending ?? 0,
    plansActive: d.plans_active ?? 0,
    promocodesActive: d.promocodes_active ?? 0,
    bannersActive: d.banners_active ?? 0,
  };
}

export interface AuditEntry {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
}

interface ApiAuditLog {
  id?: number;
  action?: string;
  auditable_type?: string | null;
  auditable_id?: number | null;
  created_at?: string | null;
  user?: { name?: string | null; email?: string | null } | null;
}

export async function fetchAuditLogs(): Promise<AuditEntry[]> {
  const res = await api<{ data: Paginated<ApiAuditLog> }>("/admin/audit-logs", {
    query: { per_page: 20 },
  });
  const rows = res.data?.data ?? [];
  return rows.map((r) => ({
    id: String(r.id ?? Math.random()),
    user: r.user?.name ?? r.user?.email ?? "—",
    action: r.action ?? "",
    target: r.auditable_type ? r.auditable_type.split("\\").pop() ?? "" : "",
    time: r.created_at ?? "",
  }));
}

export interface AuditLogDetailEntry {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
  oldValues: Record<string, unknown> | null;
  newValues: Record<string, unknown> | null;
}

/**
 * `GET /admin/audit-logs` returns a raw Laravel `LengthAwarePaginator`
 * (`response()->json(['data' => $logs])` in AdminAuditLogController) — the
 * pagination fields sit flat alongside `data`, NOT nested under a `meta` key
 * like the API-Resource-wrapped `Paginated<T>` responses elsewhere in this
 * file. Do not reuse `Paginated<T>` here — its `meta` shape does not exist
 * on this endpoint's response.
 */
interface RawLaravelPaginator<T> {
  data: T[];
  current_page?: number;
  last_page?: number;
}

export async function fetchAuditLogPage(
  page: number,
): Promise<{ entries: AuditLogDetailEntry[]; currentPage: number; lastPage: number }> {
  const res = await api<{ data: RawLaravelPaginator<ApiAuditLog & { old_values?: Record<string, unknown> | null; new_values?: Record<string, unknown> | null }> }>(
    "/admin/audit-logs",
    { query: { per_page: 20, page } },
  );
  const rows = res.data?.data ?? [];
  return {
    entries: rows.map((r) => ({
      id: String(r.id ?? Math.random()),
      user: r.user?.name ?? r.user?.email ?? "—",
      action: r.action ?? "",
      target: r.auditable_type ? r.auditable_type.split("\\").pop() ?? "" : "",
      time: r.created_at ?? "",
      oldValues: r.old_values ?? null,
      newValues: r.new_values ?? null,
    })),
    currentPage: res.data?.current_page ?? page,
    lastPage: res.data?.last_page ?? page,
  };
}

export type AdminUserRole = "user" | "subscriber" | "moderator" | "admin";
export type AdminUserStatus = "active" | "blocked" | "pending_verification";

export interface AdminUserRow {
  uuid: string;
  name: string;
  email: string;
  role: AdminUserRole;
  status: AdminUserStatus;
  city: string;
  createdAt: string;
}

interface ApiAdminUser {
  uuid: string;
  email?: string;
  name?: string | null;
  role?: string;
  status?: string;
  profile?: { display_name?: string | null; slug?: string | null } | null;
  created_at?: string | null;
}

function mapAdminUser(u: ApiAdminUser): AdminUserRow {
  return {
    uuid: u.uuid,
    name: u.profile?.display_name || u.name || u.email || "Пользователь",
    email: u.email ?? "",
    role: (u.role as AdminUserRole) ?? "user",
    status: (u.status as AdminUserStatus) ?? "active",
    city: "",
    createdAt: u.created_at ?? "",
  };
}

export async function fetchAdminUsers(opts: { role?: string; status?: string } = {}): Promise<AdminUserRow[]> {
  const res = await api<Paginated<ApiAdminUser>>("/admin/users", {
    query: {
      role: opts.role && opts.role !== "all" ? opts.role : undefined,
      status: opts.status && opts.status !== "all" ? opts.status : undefined,
      per_page: 50,
    },
  });
  return (res.data ?? []).map(mapAdminUser);
}

export async function updateAdminUser(
  uuid: string,
  patch: { name?: string; status?: AdminUserStatus; role?: AdminUserRole },
): Promise<AdminUserRow> {
  const res = await api<{ data: ApiAdminUser }>(`/admin/users/${uuid}`, {
    method: "PATCH",
    json: patch,
  });
  return mapAdminUser(res.data);
}

export type ModerationType = "posts" | "communities" | "videos";

export interface ModerationItem {
  id: number;
  type: ModerationType;
  targetId: string;
  title: string;
  author: string;
  category: string;
}

interface ApiModerationItem {
  id: number;
  queue?: string;
  status?: string;
  moderatable_type?: string;
  moderatable_id?: number;
  moderatable?: {
    uuid?: string;
    title?: string | null;
    name?: string | null;
    author?: { display_name?: string | null } | null;
    category?: { name?: string | null } | null;
  } | null;
}

function moderationTypeFromClass(cls?: string): ModerationType {
  if (cls === "Community") return "communities";
  if (cls === "Video") return "videos";
  return "posts";
}

export async function fetchModerationQueue(status = "pending"): Promise<ModerationItem[]> {
  const res = await api<Paginated<ApiModerationItem>>("/admin/moderation/queue", {
    query: { status, per_page: 50 },
  });
  return (res.data ?? []).map((m) => ({
    id: m.id,
    type: moderationTypeFromClass(m.moderatable_type),
    targetId: m.moderatable?.uuid ?? "",
    title: m.moderatable?.title ?? m.moderatable?.name ?? "Без названия",
    author: m.moderatable?.author?.display_name ?? "",
    category: m.moderatable?.category?.name ?? (m.queue ?? ""),
  }));
}

// ---- Plans (tariffs) ----
import type { Tariff, PromoCode, Banner } from "@/lib/mock";

interface ApiPlan {
  id?: number;
  slug: string;
  name: string;
  description?: string | null;
  price_cents?: number;
  period_days?: number | null;
  features?: string[] | null;
  is_active?: boolean;
  sort_order?: number | null;
}

export async function fetchAdminPlans(): Promise<Tariff[]> {
  const res = await api<{ data: Paginated<ApiPlan> }>("/admin/plans");
  const rows = res.data?.data ?? [];
  return rows.map((p) => ({
    id: p.slug,
    name: p.name,
    price: Math.round((p.price_cents ?? 0) / 100),
    period: p.period_days ? `${p.period_days} дней` : "",
    features: p.features ?? [],
  }));
}

export async function updateAdminPlan(
  slug: string,
  patch: { name?: string; price_cents?: number; period_days?: number },
): Promise<void> {
  await api(`/admin/plans/${slug}`, { method: "PATCH", json: patch });
}

// ---- Promocodes ----
interface ApiPromocode {
  id?: number;
  code: string;
  type?: string;
  value?: number;
  used_count?: number;
  max_usages?: number | null;
  valid_until?: string | null;
  is_active?: boolean;
}

export async function fetchAdminPromocodes(): Promise<PromoCode[]> {
  const res = await api<{ data: Paginated<ApiPromocode> }>("/admin/promocodes");
  const rows = res.data?.data ?? [];
  const today = new Date().toISOString().slice(0, 10);
  return rows.map((p) => {
    const expiresAt = p.valid_until ? p.valid_until.slice(0, 10) : "";
    const status: "active" | "expired" =
      p.is_active === false || (expiresAt && expiresAt < today) ? "expired" : "active";
    return {
      id: p.code,
      code: p.code,
      discount: p.value ?? 0,
      usedCount: p.used_count ?? 0,
      limit: p.max_usages ?? 0,
      expiresAt,
      status,
    };
  });
}

export async function createPromocode(input: {
  code: string;
  value: number;
  max_usages: number;
  valid_until: string;
}): Promise<void> {
  await api("/admin/promocodes", {
    method: "POST",
    json: {
      code: input.code,
      type: "percent",
      value: input.value,
      max_usages: input.max_usages,
      valid_until: input.valid_until,
      is_active: true,
    },
  });
}

export async function deletePromocode(code: string): Promise<void> {
  await api(`/admin/promocodes/${code}`, { method: "DELETE" });
}

// ---- Banners ----
interface ApiBanner {
  id: number;
  placement?: string;
  title: string;
  text?: string | null;
  link_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
}

export async function fetchAdminBanners(): Promise<Banner[]> {
  const res = await api<{ data: Paginated<ApiBanner> }>("/admin/banners");
  const rows = res.data?.data ?? [];
  return rows.map((b) => ({
    id: String(b.id),
    title: b.title,
    text: b.text ?? "",
    cta: "",
    until: "",
    color: "from-slate-700 to-slate-900",
    pinned: false,
    priority: 0,
    scheduleFrom: b.starts_at ? b.starts_at.slice(0, 10) : "",
    scheduleTo: b.ends_at ? b.ends_at.slice(0, 10) : "",
    active: b.is_active ?? true,
  }));
}

export async function updateAdminBanner(
  id: string,
  patch: { title?: string; text?: string; starts_at?: string | null; ends_at?: string | null; is_active?: boolean },
): Promise<void> {
  await api(`/admin/banners/${id}`, { method: "PATCH", json: patch });
}

export async function deleteAdminBanner(id: string): Promise<void> {
  await api(`/admin/banners/${id}`, { method: "DELETE" });
}

// ---- Notifications broadcast ----
export async function broadcastNotification(input: {
  title: string;
  body?: string;
  link?: string;
}): Promise<number> {
  const res = await api<{ data: { sent?: number } }>("/admin/notifications", {
    method: "POST",
    json: {
      title: input.title,
      ...(input.body ? { body: input.body } : {}),
      ...(input.link ? { link: input.link } : {}),
    },
  });
  return res.data?.sent ?? 0;
}

// ---- Content: posts ----
export interface AdminPostRow {
  uuid: string;
  title: string;
  author: string;
  category: string;
  community: string | null;
  status: string;
  createdAt: string;
}

interface ApiAdminPost {
  uuid: string;
  title?: string | null;
  status?: string;
  author?: { display_name?: string | null; name?: string | null } | null;
  category?: { name?: string | null } | null;
  community?: { name?: string | null } | null;
  created_at?: string;
}

export async function fetchAdminPosts(params?: { status?: string; q?: string }): Promise<AdminPostRow[]> {
  const res = await api<Paginated<ApiAdminPost>>("/admin/posts", {
    query: {
      per_page: 50,
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.q ? { q: params.q } : {}),
    },
  });
  return (res.data ?? []).map((p) => ({
    uuid: p.uuid,
    title: p.title ?? "Без названия",
    author: p.author?.display_name ?? p.author?.name ?? "—",
    category: p.category?.name ?? "—",
    community: p.community?.name ?? null,
    status: p.status ?? "",
    createdAt: p.created_at ?? "",
  }));
}

export async function updateAdminPostStatus(uuid: string, status: string): Promise<void> {
  await api(`/admin/posts/${uuid}`, { method: "PATCH", json: { status } });
}

export async function deleteAdminPost(uuid: string): Promise<void> {
  await api(`/admin/posts/${uuid}`, { method: "DELETE" });
}

// ---- Content: listings ----
export interface AdminListingRow {
  uuid: string;
  title: string;
  author: string;
  category: string;
  price: number;
  status: string;
  createdAt: string;
}

interface ApiAdminListing {
  uuid: string;
  title?: string | null;
  status?: string;
  price_cents?: number | null;
  author?: { display_name?: string | null; name?: string | null } | null;
  category?: { name?: string | null } | null;
  created_at?: string;
}

export async function fetchAdminListings(params?: { status?: string; q?: string }): Promise<AdminListingRow[]> {
  const res = await api<Paginated<ApiAdminListing>>("/admin/listings", {
    query: {
      per_page: 50,
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.q ? { q: params.q } : {}),
    },
  });
  return (res.data ?? []).map((l) => ({
    uuid: l.uuid,
    title: l.title ?? "Без названия",
    author: l.author?.display_name ?? l.author?.name ?? "—",
    category: l.category?.name ?? "—",
    price: Math.round((l.price_cents ?? 0) / 100),
    status: l.status ?? "",
    createdAt: l.created_at ?? "",
  }));
}

export async function updateAdminListingStatus(uuid: string, status: string): Promise<void> {
  await api(`/admin/listings/${uuid}`, { method: "PATCH", json: { status } });
}

export async function deleteAdminListing(uuid: string): Promise<void> {
  await api(`/admin/listings/${uuid}`, { method: "DELETE" });
}

// ---- Categories ----
export type CategoryKind = "post" | "community" | "listing";

export interface AdminCategory {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
}

interface ApiAdminCategory {
  id: number;
  parent_id?: number | null;
  name: string;
  slug: string;
  icon?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
}

function mapAdminCategory(c: ApiAdminCategory): AdminCategory {
  return {
    id: c.id,
    parentId: c.parent_id ?? null,
    name: c.name,
    slug: c.slug,
    icon: c.icon ?? null,
    sortOrder: c.sort_order ?? 0,
    isActive: c.is_active ?? true,
  };
}

export async function fetchAdminCategories(kind: CategoryKind): Promise<AdminCategory[]> {
  const res = await api<{ data: Paginated<ApiAdminCategory> | ApiAdminCategory[] }>(
    `/admin/categories/${kind}`,
    { query: { per_page: 200 } },
  );
  const payload = res.data as Paginated<ApiAdminCategory> | ApiAdminCategory[] | undefined;
  const list = Array.isArray(payload) ? payload : (payload?.data ?? []);
  return list.map(mapAdminCategory);
}

export interface UpsertCategoryInput {
  name: string;
  slug: string;
  parentId?: number | null;
  icon?: string | null;
  sortOrder?: number;
  isActive?: boolean;
}

function categoryBody(input: UpsertCategoryInput): Record<string, unknown> {
  return {
    name: input.name,
    slug: input.slug,
    parent_id: input.parentId ?? null,
    icon: input.icon ?? null,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
  };
}

export async function createAdminCategory(
  kind: CategoryKind,
  input: UpsertCategoryInput,
): Promise<AdminCategory> {
  const res = await api<{ data: ApiAdminCategory }>(`/admin/categories/${kind}`, {
    method: "POST",
    json: categoryBody(input),
  });
  return mapAdminCategory(res.data);
}

export async function updateAdminCategory(
  kind: CategoryKind,
  id: number,
  input: UpsertCategoryInput,
): Promise<AdminCategory> {
  const res = await api<{ data: ApiAdminCategory }>(`/admin/categories/${kind}/${id}`, {
    method: "PUT",
    json: categoryBody(input),
  });
  return mapAdminCategory(res.data);
}

export async function deleteAdminCategory(kind: CategoryKind, id: number): Promise<void> {
  await api(`/admin/categories/${kind}/${id}`, { method: "DELETE" });
}

// ---- System settings ----
export interface AdminSetting {
  key: string;
  value: unknown;
  group: string;
}

interface ApiAdminSetting {
  key: string;
  value: unknown;
  group?: string | null;
}

export async function fetchAdminSettings(): Promise<AdminSetting[]> {
  const res = await api<{ data: ApiAdminSetting[] }>("/admin/settings");
  return (res.data ?? []).map((s) => ({ key: s.key, value: s.value, group: s.group ?? "general" }));
}

export async function updateAdminSettings(settings: AdminSetting[]): Promise<AdminSetting[]> {
  const res = await api<{ data: ApiAdminSetting[] }>("/admin/settings", {
    method: "PATCH",
    json: { settings: settings.map((s) => ({ key: s.key, value: s.value, group: s.group })) },
  });
  return (res.data ?? []).map((s) => ({ key: s.key, value: s.value, group: s.group ?? "general" }));
}

export async function approveModeration(type: ModerationType, id: string): Promise<void> {
  await api(`/admin/moderation/${type}/${id}/approve`, { method: "POST" });
}

export async function rejectModeration(type: ModerationType, id: string, reason?: string): Promise<void> {
  await api(`/admin/moderation/${type}/${id}/reject`, { method: "POST", json: { reason } });
}

export async function reviseModeration(type: ModerationType, id: string, comment?: string): Promise<void> {
  await api(`/admin/moderation/${type}/${id}/revision`, { method: "POST", json: { comment } });
}

export type FeedbackStatus = "new" | "read" | "resolved";

export interface FeedbackRow {
  id: number;
  subject: string;
  message: string;
  page: string;
  status: FeedbackStatus;
  author: string;
  createdAt: string;
}

interface ApiFeedback {
  id: number;
  subject?: string | null;
  message?: string | null;
  page?: string | null;
  status?: string | null;
  created_at?: string | null;
  user?: { id?: number; name?: string | null } | null;
}

export async function fetchAdminFeedback(status?: FeedbackStatus): Promise<FeedbackRow[]> {
  const res = await api<Paginated<ApiFeedback>>("/admin/feedback", {
    query: { per_page: 50, ...(status ? { status } : {}) },
  });
  return (res.data ?? []).map((f) => ({
    id: f.id,
    subject: f.subject ?? "",
    message: f.message ?? "",
    page: f.page ?? "",
    status: (f.status as FeedbackStatus) ?? "new",
    author: f.user?.name ?? "Гость",
    createdAt: f.created_at ?? "",
  }));
}

export async function updateAdminFeedbackStatus(id: number, status: FeedbackStatus): Promise<void> {
  await api(`/admin/feedback/${id}`, { method: "PATCH", json: { status } });
}

// ---- Reports (жалобы пользователей) ----
export type ReportStatus = "pending" | "reviewing" | "resolved" | "rejected" | "dismissed";

export interface AdminReportRow {
  id: number;
  reason: string;
  description: string;
  status: ReportStatus;
  targetType: string;
  targetUuid: string | null;
  reporterName: string;
  reporterEmail: string;
  createdAt: string;
  resolvedAt: string | null;
}

interface ApiAdminReport {
  id: number;
  reason?: string;
  description?: string | null;
  status?: string;
  target_type?: string;
  target_uuid?: string | null;
  reporter?: { uuid?: string; name?: string | null; email?: string | null } | null;
  created_at?: string | null;
  resolved_at?: string | null;
}

export async function fetchAdminReports(status?: ReportStatus): Promise<AdminReportRow[]> {
  const res = await api<Paginated<ApiAdminReport>>("/admin/reports", {
    query: { per_page: 50, ...(status ? { status } : {}) },
  });
  return (res.data ?? []).map((r) => ({
    id: r.id,
    reason: r.reason ?? "",
    description: r.description ?? "",
    status: (r.status as ReportStatus) ?? "pending",
    targetType: r.target_type ?? "",
    targetUuid: r.target_uuid ?? null,
    reporterName: r.reporter?.name ?? "Пользователь",
    reporterEmail: r.reporter?.email ?? "",
    createdAt: r.created_at ?? "",
    resolvedAt: r.resolved_at ?? null,
  }));
}

export async function updateAdminReportStatus(id: number, status: ReportStatus): Promise<void> {
  await api(`/admin/reports/${id}`, { method: "PATCH", json: { status } });
}

// ---- Delivery (СДЭК / Яндекс) ----
export interface AdminDeliveryStats {
  shipmentsTotal: number;
  shipmentsByProvider: Record<string, number>;
  shipmentsByStatus: Record<string, number>;
  deliveryRevenueCents: number;
  avgDeliveryDays: number | null;
  errorsLast7d: number;
}

interface ApiAdminDeliveryStats {
  shipments_total?: number;
  shipments_by_provider?: Record<string, number>;
  shipments_by_status?: Record<string, number>;
  delivery_revenue_cents?: number;
  avg_delivery_days?: number | null;
  errors_last_7d?: number;
}

export async function fetchAdminDeliveryStats(): Promise<AdminDeliveryStats> {
  const res = await api<{ data: ApiAdminDeliveryStats }>("/admin/delivery/stats");
  const d = res.data ?? {};
  return {
    shipmentsTotal: d.shipments_total ?? 0,
    shipmentsByProvider: d.shipments_by_provider ?? {},
    shipmentsByStatus: d.shipments_by_status ?? {},
    deliveryRevenueCents: d.delivery_revenue_cents ?? 0,
    avgDeliveryDays: d.avg_delivery_days ?? null,
    errorsLast7d: d.errors_last_7d ?? 0,
  };
}

export interface AdminShipmentRow {
  uuid: string;
  provider: string;
  status: string;
  trackingNumber: string | null;
  deliveryCostCents: number | null;
  listingTitle: string;
  externalId: string | null;
  errorMessage: string | null;
  adminNote: string | null;
  createdAt: string;
}

interface ApiAdminShipment {
  uuid: string;
  provider?: string;
  status?: string;
  tracking_number?: string | null;
  delivery_cost_cents?: number | null;
  external_id?: string | null;
  error_message?: string | null;
  admin_note?: string | null;
  created_at?: string | null;
  listing?: { title?: string | null } | null;
}

function mapAdminShipment(s: ApiAdminShipment): AdminShipmentRow {
  return {
    uuid: s.uuid,
    provider: s.provider ?? "",
    status: s.status ?? "",
    trackingNumber: s.tracking_number ?? null,
    deliveryCostCents: s.delivery_cost_cents ?? null,
    listingTitle: s.listing?.title ?? "—",
    externalId: s.external_id ?? null,
    errorMessage: s.error_message ?? null,
    adminNote: s.admin_note ?? null,
    createdAt: s.created_at ?? "",
  };
}

export async function fetchAdminShipments(opts: {
  status?: string;
  provider?: string;
  perPage?: number;
} = {}): Promise<AdminShipmentRow[]> {
  const res = await api<Paginated<ApiAdminShipment>>("/admin/delivery/shipments", {
    query: {
      per_page: opts.perPage ?? 50,
      ...(opts.status && opts.status !== "all" ? { status: opts.status } : {}),
      ...(opts.provider && opts.provider !== "all" ? { provider: opts.provider } : {}),
    },
  });
  return (res.data ?? []).map(mapAdminShipment);
}

export async function updateAdminShipment(
  uuid: string,
  patch: { admin_note?: string | null; status?: string },
): Promise<AdminShipmentRow> {
  const res = await api<{ data: ApiAdminShipment }>(`/admin/delivery/shipments/${uuid}`, {
    method: "PATCH",
    json: patch,
  });
  return mapAdminShipment(res.data);
}
