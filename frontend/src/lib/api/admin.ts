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

/** Moderator-safe dashboard counters (no admin-only /admin/dashboard). */
export async function fetchModeratorDashboardStats(): Promise<Pick<AdminDashboard, "moderationPending" | "reportsPending">> {
  const [modRes, repRes] = await Promise.all([
    api<Paginated<unknown>>("/admin/moderation/queue", { query: { status: "pending", per_page: 1 } }),
    api<Paginated<unknown>>("/admin/reports", { query: { status: "pending", per_page: 1 } }),
  ]);
  return {
    moderationPending: modRes.meta?.total ?? modRes.data?.length ?? 0,
    reportsPending: repRes.meta?.total ?? repRes.data?.length ?? 0,
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

export type ModerationType = "posts" | "communities" | "videos" | "channel_posts";

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
  if (cls === "ChannelPost") return "channel_posts";
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
  free_listings_per_month?: number;
  listing_discount_percent?: number;
}

export interface AdminPlanRow {
  slug: string;
  name: string;
  priceCents: number;
  periodDays: number;
  freeListingsPerMonth: number;
  listingDiscountPercent: number;
}

export async function fetchAdminPlansDetailed(): Promise<AdminPlanRow[]> {
  const res = await api<{ data: Paginated<ApiPlan> }>("/admin/plans");
  const rows = res.data?.data ?? [];
  return rows.map((p) => ({
    slug: p.slug,
    name: p.name,
    priceCents: p.price_cents ?? 0,
    periodDays: p.period_days ?? 30,
    freeListingsPerMonth: p.free_listings_per_month ?? 0,
    listingDiscountPercent: p.listing_discount_percent ?? 0,
  }));
}

export async function fetchAdminPlans(): Promise<Tariff[]> {
  const rows = await fetchAdminPlansDetailed();
  return rows.map((p) => ({
    id: p.slug,
    name: p.name,
    price: Math.round(p.priceCents / 100),
    period: p.periodDays ? `${p.periodDays} дней` : "",
    features: [],
  }));
}

export async function updateAdminPlan(
  slug: string,
  patch: {
    name?: string;
    price_cents?: number;
    period_days?: number;
    free_listings_per_month?: number;
    listing_discount_percent?: number;
  },
): Promise<void> {
  await api(`/admin/plans/${slug}`, { method: "PATCH", json: patch });
}

// ---- Promocodes ----
interface ApiPromocode {
  id?: number;
  code: string;
  type?: string;
  scope?: string;
  value?: number;
  used_count?: number;
  usages_count?: number;
  max_usages?: number | null;
  listing_category_id?: number | null;
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
      usedCount: p.usages_count ?? p.used_count ?? 0,
      limit: p.max_usages ?? 0,
      expiresAt,
      status,
    };
  });
}

export async function createPromocode(input: {
  code: string;
  type?: "percent" | "fixed" | "free";
  scope?: "listing_placement" | "subscription" | "boost" | "all";
  value: number;
  max_usages: number;
  valid_until: string;
  listing_category_id?: number | null;
  notify_mode?: "none" | "all" | "selected";
  notify_title?: string;
  notify_body?: string;
  notify_user_ids?: number[];
}): Promise<{ notifications_sent?: number }> {
  const res = await api<{ data: unknown; notifications_sent?: number }>("/admin/promocodes", {
    method: "POST",
    json: {
      code: input.code,
      type: input.type ?? "percent",
      scope: input.scope ?? "listing_placement",
      value: input.value,
      max_usages: input.max_usages,
      valid_until: input.valid_until,
      listing_category_id: input.listing_category_id ?? null,
      is_active: true,
      notify_mode: input.notify_mode ?? "none",
      notify_title: input.notify_title,
      notify_body: input.notify_body,
      notify_user_ids: input.notify_user_ids,
    },
  });
  return { notifications_sent: res.notifications_sent };
}

export async function deletePromocode(code: string): Promise<void> {
  await api(`/admin/promocodes/${code}`, { method: "DELETE" });
}

// ---- Banners ----
export interface BannerCarouselSettings {
  enabled: boolean;
  placement: string;
  autoplay_seconds: number;
  max_slides: number;
}

export interface AdminBannerRow {
  id: string;
  placement: string;
  title: string;
  text: string;
  ctaText: string;
  kind: "event" | "news" | "promo" | "";
  untilLabel: string;
  linkUrl: string;
  imageUrl: string | null;
  imageMediaUuid: string | null;
  startsAt: string;
  endsAt: string;
  isActive: boolean;
  forceVisible: boolean;
  isPinned: boolean;
  priority: number;
  sortOrder: number;
  impressionsCount: number;
  clicksCount: number;
}

interface ApiBanner {
  id: number;
  placement?: string;
  title: string;
  text?: string | null;
  cta_text?: string | null;
  kind?: string | null;
  until_label?: string | null;
  link_url?: string | null;
  image_url?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
  force_visible?: boolean;
  is_pinned?: boolean;
  priority?: number;
  sort_order?: number;
  impressions_count?: number;
  clicks_count?: number;
}

function mapAdminBanner(b: ApiBanner): AdminBannerRow {
  return {
    id: String(b.id),
    placement: b.placement ?? "events",
    title: b.title,
    text: b.text ?? "",
    ctaText: b.cta_text?.trim() || "Подробнее",
    kind: (b.kind === "event" || b.kind === "news" || b.kind === "promo" ? b.kind : "") as AdminBannerRow["kind"],
    untilLabel: b.until_label ?? "",
    linkUrl: b.link_url ?? "",
    imageUrl: b.image_url ?? null,
    imageMediaUuid: null,
    startsAt: b.starts_at ? b.starts_at.slice(0, 10) : "",
    endsAt: b.ends_at ? b.ends_at.slice(0, 10) : "",
    isActive: b.is_active ?? true,
    forceVisible: b.force_visible ?? false,
    isPinned: b.is_pinned ?? false,
    priority: b.priority ?? 0,
    sortOrder: b.sort_order ?? 0,
    impressionsCount: b.impressions_count ?? 0,
    clicksCount: b.clicks_count ?? 0,
  };
}

export async function fetchAdminBanners(): Promise<{ banners: AdminBannerRow[]; carousel: BannerCarouselSettings }> {
  const res = await api<{ data: Paginated<ApiBanner>; meta?: { carousel?: BannerCarouselSettings } }>("/admin/banners");
  const rows = res.data?.data ?? [];
  return {
    banners: rows.map(mapAdminBanner),
    carousel: res.meta?.carousel ?? {
      enabled: true,
      placement: "events",
      autoplay_seconds: 10,
      max_slides: 5,
    },
  };
}

/** @deprecated Use AdminBannerRow via fetchAdminBanners */
export async function fetchAdminBannersLegacy(): Promise<Banner[]> {
  const { banners } = await fetchAdminBanners();
  return banners.map((b) => ({
    id: b.id,
    title: b.title,
    text: b.text,
    cta: b.ctaText,
    until: b.untilLabel,
    color: "from-slate-700 to-slate-900",
    pinned: b.isPinned,
    priority: b.priority,
    scheduleFrom: b.startsAt,
    scheduleTo: b.endsAt,
    active: b.isActive,
  }));
}

export async function createAdminBanner(input: {
  placement: string;
  title: string;
  text?: string;
  cta_text?: string;
  kind?: string;
  until_label?: string;
  link_url?: string;
  image_media_uuid?: string;
  starts_at?: string | null;
  ends_at?: string | null;
  is_active?: boolean;
  force_visible?: boolean;
  is_pinned?: boolean;
  priority?: number;
  sort_order?: number;
}): Promise<AdminBannerRow> {
  const res = await api<{ data: ApiBanner }>("/admin/banners", { method: "POST", json: input });
  return mapAdminBanner(res.data);
}

export async function updateAdminBanner(
  id: string,
  patch: {
    placement?: string;
    title?: string;
    text?: string;
    cta_text?: string;
    kind?: string | null;
    until_label?: string | null;
    link_url?: string | null;
    image_media_uuid?: string | null;
    starts_at?: string | null;
    ends_at?: string | null;
    is_active?: boolean;
    force_visible?: boolean;
    is_pinned?: boolean;
    priority?: number;
    sort_order?: number;
  },
): Promise<AdminBannerRow> {
  const res = await api<{ data: ApiBanner }>(`/admin/banners/${id}`, { method: "PATCH", json: patch });
  return mapAdminBanner(res.data);
}

export async function deleteAdminBanner(id: string): Promise<void> {
  await api(`/admin/banners/${id}`, { method: "DELETE" });
}

export async function updateBannerCarouselSettings(
  patch: Partial<BannerCarouselSettings>,
): Promise<BannerCarouselSettings> {
  const res = await api<{ data: BannerCarouselSettings }>("/admin/banners/carousel/settings", {
    method: "PATCH",
    json: patch,
  });
  return res.data;
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
  body: string;
  author: string;
  category: string;
  community: string | null;
  status: string;
  createdAt: string;
  images: string[];
  video?: string;
}

interface ApiAdminPost {
  uuid: string;
  title?: string | null;
  body?: string | null;
  status?: string;
  author?: { display_name?: string | null; name?: string | null } | null;
  category?: { name?: string | null } | null;
  community?: { name?: string | null } | null;
  created_at?: string;
  media?: Array<{
    type?: string;
    media?: { url?: string | null; mime_type?: string | null } | null;
  }>;
}

function mapAdminPostMedia(p: ApiAdminPost): { images: string[]; video?: string } {
  const media = p.media ?? [];
  const isVideo = (m: (typeof media)[number]) =>
    m.type === "video" || (m.media?.mime_type ?? "").startsWith("video/");
  const images = media
    .filter((m) => !isVideo(m))
    .map((m) => m.media?.url)
    .filter((u): u is string => Boolean(u));
  const video = media.find(isVideo)?.media?.url ?? undefined;
  return { images, video };
}

export async function fetchAdminPosts(params?: { status?: string; q?: string }): Promise<AdminPostRow[]> {
  const res = await api<Paginated<ApiAdminPost>>("/admin/posts", {
    query: {
      per_page: 50,
      ...(params?.status ? { status: params.status } : {}),
      ...(params?.q ? { q: params.q } : {}),
    },
  });
  return (res.data ?? []).map((p) => {
    const { images, video } = mapAdminPostMedia(p);
    return {
      uuid: p.uuid,
      title: p.title ?? "Без названия",
      body: p.body ?? "",
      author: p.author?.display_name ?? p.author?.name ?? "—",
      category: p.category?.name ?? "—",
      community: p.community?.name ?? null,
      status: p.status ?? "",
      createdAt: p.created_at ?? "",
      images,
      video,
    };
  });
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

export async function bulkUpdateAdminListingStatus(
  uuids: string[],
  status: string,
): Promise<{ ok: number; failed: number }> {
  const results = await Promise.allSettled(uuids.map((uuid) => updateAdminListingStatus(uuid, status)));
  return {
    ok: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}

export async function bulkDeleteAdminListings(uuids: string[]): Promise<{ ok: number; failed: number }> {
  const results = await Promise.allSettled(uuids.map((uuid) => deleteAdminListing(uuid)));
  return {
    ok: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}

export interface AdminListingDetail {
  uuid: string;
  title: string;
  description: string;
  price: number;
  status: string;
  author: string;
  authorUuid: string;
  category: string;
  subcategory: string;
  city: string;
  images: string[];
  viewsCount: number;
  favoritesCount: number;
  rejectionReason: string;
  publishedAt: string;
  createdAt: string;
}

interface ApiListingDetail {
  uuid: string;
  title?: string | null;
  description?: string | null;
  price_cents?: number | null;
  status?: string;
  rejection_reason?: string | null;
  views_count?: number;
  favorites_count?: number;
  published_at?: string | null;
  created_at?: string;
  author?: { uuid?: string; display_name?: string | null; name?: string | null } | null;
  category?: { name?: string | null } | null;
  subcategory?: { name?: string | null } | null;
  city?: { name?: string | null } | null;
  media?: Array<{ url?: string | null }> | null;
}

function mapAdminListingDetail(l: ApiListingDetail): AdminListingDetail {
  return {
    uuid: l.uuid,
    title: l.title ?? "",
    description: l.description ?? "",
    price: Math.round((l.price_cents ?? 0) / 100),
    status: l.status ?? "",
    author: l.author?.display_name ?? l.author?.name ?? "—",
    authorUuid: l.author?.uuid ?? "",
    category: l.category?.name ?? "—",
    subcategory: l.subcategory?.name ?? "",
    city: l.city?.name ?? "",
    images: (l.media ?? []).map((m) => m.url).filter((url): url is string => Boolean(url)),
    viewsCount: l.views_count ?? 0,
    favoritesCount: l.favorites_count ?? 0,
    rejectionReason: l.rejection_reason ?? "",
    publishedAt: l.published_at ?? "",
    createdAt: l.created_at ?? "",
  };
}

export async function fetchAdminListing(uuid: string): Promise<AdminListingDetail> {
  const res = await api<{ data: ApiListingDetail }>(`/admin/listings/${uuid}`);
  return mapAdminListingDetail(res.data);
}

export interface AdminListingUpdatePayload {
  status?: string;
  title?: string;
  description?: string;
  price_cents?: number;
  rejection_reason?: string | null;
}

export async function updateAdminListing(uuid: string, payload: AdminListingUpdatePayload): Promise<AdminListingDetail> {
  const res = await api<{ data: ApiListingDetail }>(`/admin/listings/${uuid}`, {
    method: "PATCH",
    json: payload,
  });
  return mapAdminListingDetail(res.data);
}

export async function deleteAdminListing(uuid: string): Promise<void> {
  await api(`/admin/listings/${uuid}`, { method: "DELETE" });
}

// ---- Categories ----
export type CategoryKind = "post" | "community" | "listing" | "video";

export interface AdminCategory {
  id: number;
  parentId: number | null;
  name: string;
  slug: string;
  icon: string | null;
  sortOrder: number;
  isActive: boolean;
  listingPriceCents: number | null;
  subscriberListingPriceCents: number | null;
  videosCount?: number;
}

interface ApiAdminCategory {
  id: number;
  parent_id?: number | null;
  name: string;
  slug: string;
  icon?: string | null;
  sort_order?: number | null;
  is_active?: boolean;
  listing_price_cents?: number | null;
  subscriber_listing_price_cents?: number | null;
  videos_count?: number;
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
    listingPriceCents: c.listing_price_cents ?? null,
    subscriberListingPriceCents: c.subscriber_listing_price_cents ?? null,
    videosCount: c.videos_count,
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
  listingPriceCents?: number | null;
  subscriberListingPriceCents?: number | null;
}

function categoryBody(input: UpsertCategoryInput): Record<string, unknown> {
  return {
    name: input.name,
    slug: input.slug,
    parent_id: input.parentId ?? null,
    icon: input.icon ?? null,
    sort_order: input.sortOrder ?? 0,
    is_active: input.isActive ?? true,
    listing_price_cents: input.listingPriceCents ?? null,
    subscriber_listing_price_cents: input.subscriberListingPriceCents ?? null,
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

export async function reorderAdminVideoCategories(ids: number[]): Promise<void> {
  await api("/admin/categories/video/reorder", {
    method: "PATCH",
    json: { ids },
  });
}

// ---- Admin videos (reviews) ----
export interface AdminVideoRow {
  uuid: string;
  title: string;
  author: string;
  category: string;
  status: string;
  views: number;
  videoUrl?: string;
  posterUrl?: string;
  scheduledAt?: string;
  isFeatured: boolean;
  durationSeconds?: number;
  likesCount: number;
  commentsCount: number;
  publishedAt?: string;
}

export interface AdminVideoDetail extends AdminVideoRow {
  description: string;
  tags: string[];
  categoryId?: string;
}

interface ApiAdminVideo {
  uuid: string;
  title?: string;
  description?: string | null;
  status?: string;
  views_count?: number;
  video_url?: string | null;
  poster_url?: string | null;
  scheduled_at?: string | null;
  published_at?: string | null;
  duration_seconds?: number | null;
  likes_count?: number | null;
  comments_count?: number | null;
  is_featured?: boolean;
  tags?: string[];
  category?: { id?: string; title?: string | null } | null;
  uploader?: { display_name?: string | null } | null;
}

function mapAdminVideo(v: ApiAdminVideo): AdminVideoRow {
  return {
    uuid: v.uuid,
    title: v.title ?? "",
    author: v.uploader?.display_name ?? "—",
    category: v.category?.title ?? "—",
    status: v.status ?? "processing",
    views: Number(v.views_count ?? 0),
    videoUrl: v.video_url ?? undefined,
    posterUrl: v.poster_url ?? undefined,
    scheduledAt: v.scheduled_at ?? undefined,
    publishedAt: v.published_at ?? undefined,
    durationSeconds: v.duration_seconds ?? undefined,
    likesCount: Number(v.likes_count ?? 0),
    commentsCount: Number(v.comments_count ?? 0),
    isFeatured: Boolean(v.is_featured),
  };
}

function mapAdminVideoDetail(v: ApiAdminVideo): AdminVideoDetail {
  return {
    ...mapAdminVideo(v),
    description: v.description ?? "",
    tags: v.tags ?? [],
    categoryId: v.category?.id,
  };
}

export async function fetchAdminVideo(uuid: string): Promise<AdminVideoDetail> {
  const res = await api<{ data: ApiAdminVideo }>(`/admin/videos/${uuid}`);
  return mapAdminVideoDetail(res.data);
}

export async function fetchAdminVideos(params?: { status?: string; q?: string }): Promise<AdminVideoRow[]> {
  const res = await api<{ data: Paginated<ApiAdminVideo> | ApiAdminVideo[] }>("/admin/videos", {
    query: { status: params?.status || undefined, q: params?.q || undefined, per_page: 100 },
  });
  const payload = res.data as Paginated<ApiAdminVideo> | ApiAdminVideo[] | undefined;
  const list = Array.isArray(payload) ? payload : (payload?.data ?? []);
  return list.map(mapAdminVideo);
}

export async function updateAdminVideo(
  uuid: string,
  patch: {
    status?: string;
    isFeatured?: boolean;
    title?: string;
    description?: string;
    categoryId?: string;
    tags?: string[];
    posterMediaId?: string | null;
    videoMediaId?: string;
  },
): Promise<AdminVideoDetail> {
  const res = await api<{ data: ApiAdminVideo }>(`/admin/videos/${uuid}`, {
    method: "PATCH",
    json: {
      status: patch.status,
      is_featured: patch.isFeatured,
      title: patch.title,
      description: patch.description,
      category_id: patch.categoryId,
      tags: patch.tags,
      poster_media_id: patch.posterMediaId,
      video_media_id: patch.videoMediaId,
    },
  });
  return mapAdminVideoDetail(res.data);
}

export async function deleteAdminVideo(uuid: string): Promise<void> {
  await api(`/admin/videos/${uuid}`, { method: "DELETE" });
}

export async function bulkUpdateAdminVideoStatus(
  uuids: string[],
  status: string,
): Promise<{ ok: number; failed: number }> {
  const results = await Promise.allSettled(uuids.map((uuid) => updateAdminVideo(uuid, { status })));
  return {
    ok: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}

export async function bulkDeleteAdminVideos(uuids: string[]): Promise<{ ok: number; failed: number }> {
  const results = await Promise.allSettled(uuids.map((uuid) => deleteAdminVideo(uuid)));
  return {
    ok: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
}

export async function bulkApproveAdminVideos(uuids: string[]): Promise<{ ok: number; failed: number }> {
  const results = await Promise.allSettled(uuids.map((uuid) => approveModeration("videos", uuid)));
  return {
    ok: results.filter((r) => r.status === "fulfilled").length,
    failed: results.filter((r) => r.status === "rejected").length,
  };
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

export async function fetchAdminReports(status?: ReportStatus, targetTypes?: string[]): Promise<AdminReportRow[]> {
  const res = await api<Paginated<ApiAdminReport>>("/admin/reports", {
    query: {
      per_page: 50,
      ...(status ? { status } : {}),
      ...(targetTypes?.length ? { target_types: targetTypes.join(",") } : {}),
    },
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

// ---- Landing page blocks ----
export interface AdminLandingSection {
  id: number;
  slug: string;
  eyebrow: string | null;
  title: string;
  subtitle: string | null;
  is_enabled: boolean;
}

export interface AdminLandingCard {
  id: number;
  section_slug: string;
  title: string;
  description: string | null;
  icon: string;
  icon_url: string | null;
  link_url: string | null;
  post_category_id: number | null;
  sort_order: number;
  is_active: boolean;
}

export async function fetchAdminLandingBlocks(): Promise<{
  sections: AdminLandingSection[];
  cards: AdminLandingCard[];
}> {
  const res = await api<{ data: { sections: AdminLandingSection[]; cards: AdminLandingCard[] } }>("/admin/landing/blocks");
  return res.data ?? { sections: [], cards: [] };
}

export async function updateAdminLandingSection(
  slug: string,
  patch: Partial<Pick<AdminLandingSection, "eyebrow" | "title" | "subtitle" | "is_enabled">>,
): Promise<void> {
  await api(`/admin/landing/sections/${slug}`, { method: "PATCH", json: patch });
}

export async function createAdminLandingCard(input: {
  section_slug: string;
  title: string;
  description?: string;
  icon?: string;
  icon_url?: string | null;
  link_url?: string;
  post_category_id?: number | null;
  is_active?: boolean;
}): Promise<AdminLandingCard> {
  const res = await api<{ data: AdminLandingCard }>("/admin/landing/cards", { method: "POST", json: input });
  return res.data;
}

export async function updateAdminLandingCard(
  id: number,
  patch: Partial<Omit<AdminLandingCard, "id">>,
): Promise<AdminLandingCard> {
  const res = await api<{ data: AdminLandingCard }>(`/admin/landing/cards/${id}`, { method: "PATCH", json: patch });
  return res.data;
}

export async function deleteAdminLandingCard(id: number): Promise<void> {
  await api(`/admin/landing/cards/${id}`, { method: "DELETE" });
}

export async function reorderAdminLandingCards(sectionSlug: string, ids: number[]): Promise<void> {
  await api("/admin/landing/cards/reorder", { method: "PATCH", json: { section_slug: sectionSlug, ids } });
}
