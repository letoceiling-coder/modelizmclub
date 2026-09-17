import { api, ApiError } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";

/**
 * Мероприятия — событие сообщества и событие площадки одной формой.
 *
 * Сервер: `ClubEventResource`. Права приходят блоком `can` и считаются
 * `EventPolicy` — кнопки на экране и запреты за ними решает один код.
 * «Прошло» сервер отдаёт в `display_status`; клиент сам по часам не судит.
 */

export type EventScope = "community" | "platform";
export type EventStatus = "draft" | "published" | "cancelled";
export type EventDisplayStatus = EventStatus | "past";
export type EventWhen = "upcoming" | "past" | "all";

export interface ClubEvent {
  uuid: string;
  scope: EventScope;
  status: EventStatus;
  displayStatus: EventDisplayStatus;
  title: string;
  description: string | null;
  startsAt: string;
  locationName: string | null;
  latitude: number | null;
  longitude: number | null;
  mapUrl: string | null;
  coverUuid: string | null;
  coverUrl: string | null;
  community: { slug: string; name: string; isOpen: boolean } | null;
  creator: { name: string; slug: string | null } | null;
  cancelledAt: string | null;
  cancelReason: string | null;
  attendeesCount: number;
  going: boolean;
  /** cancel — отменить: команда сообщества или модерация площадки; update — только команда. */
  can: { update: boolean; delete: boolean; cancel: boolean; attend: boolean; manage: boolean };
  deletedAt: string | null;
}

export interface EventAttendee {
  uuid: string;
  name: string;
  slug: string | null;
  avatarUrl: string | null;
}

export interface Paged<T> {
  items: T[];
  total: number;
  page: number;
  lastPage: number;
}

export interface EventInput {
  title: string;
  description?: string | null;
  /** ISO-строка с поясом. */
  startsAt?: string;
  locationName?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  coverMediaUuid?: string | null;
  status?: "draft" | "published";
}

interface ApiEvent {
  uuid: string;
  scope?: EventScope;
  status?: EventStatus;
  display_status?: EventDisplayStatus;
  title: string;
  description?: string | null;
  starts_at: string;
  location_name?: string | null;
  latitude?: number | string | null;
  longitude?: number | string | null;
  map_url?: string | null;
  cover?: { uuid?: string | null; url?: string | null } | null;
  community?: { slug: string; name: string; is_open?: boolean } | null;
  creator?: { display_name?: string | null; slug?: string | null } | null;
  cancelled_at?: string | null;
  cancel_reason?: string | null;
  attendees_count?: number;
  going?: boolean;
  can?: Partial<ClubEvent["can"]>;
  deleted_at?: string | null;
}

interface ApiUser {
  uuid: string;
  display_name?: string | null;
  slug?: string | null;
  avatar?: { url?: string | null } | null;
}

interface ApiPage<T> {
  data: T[];
  meta?: { total?: number; current_page?: number; last_page?: number };
}

const num = (v: number | string | null | undefined): number | null =>
  v === null || v === undefined || v === "" ? null : Number(v);

export function mapEvent(e: ApiEvent): ClubEvent {
  const status = e.status ?? "published";
  return {
    uuid: e.uuid,
    scope: e.scope ?? "community",
    status,
    displayStatus: e.display_status ?? status,
    title: e.title,
    description: e.description ?? null,
    startsAt: e.starts_at,
    locationName: e.location_name ?? null,
    latitude: num(e.latitude),
    longitude: num(e.longitude),
    mapUrl: e.map_url ?? null,
    coverUuid: e.cover?.uuid ?? null,
    coverUrl: e.cover?.url ?? null,
    community: e.community
      ? { slug: e.community.slug, name: e.community.name, isOpen: Boolean(e.community.is_open) }
      : null,
    creator: e.creator
      ? { name: e.creator.display_name ?? "", slug: e.creator.slug ?? null }
      : null,
    cancelledAt: e.cancelled_at ?? null,
    cancelReason: e.cancel_reason ?? null,
    attendeesCount: e.attendees_count ?? 0,
    going: Boolean(e.going),
    can: {
      update: Boolean(e.can?.update),
      delete: Boolean(e.can?.delete),
      cancel: Boolean(e.can?.cancel),
      attend: Boolean(e.can?.attend),
      manage: Boolean(e.can?.manage),
    },
    deletedAt: e.deleted_at ?? null,
  };
}

function mapPage<A, T>(res: ApiPage<A>, map: (a: A) => T): Paged<T> {
  return {
    items: (res.data ?? []).map(map),
    total: res.meta?.total ?? res.data?.length ?? 0,
    page: res.meta?.current_page ?? 1,
    lastPage: res.meta?.last_page ?? 1,
  };
}

function mapAttendee(u: ApiUser): EventAttendee {
  return {
    uuid: u.uuid,
    name: u.display_name || "Участник",
    slug: u.slug ?? null,
    avatarUrl: u.avatar?.url ?? null,
  };
}

function toPayload(input: Partial<EventInput>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  if (input.title !== undefined) out.title = input.title;
  if (input.description !== undefined) out.description = input.description || null;
  if (input.startsAt !== undefined) out.starts_at = input.startsAt;
  if (input.locationName !== undefined) out.location_name = input.locationName || null;
  if (input.latitude !== undefined) out.latitude = input.latitude;
  if (input.longitude !== undefined) out.longitude = input.longitude;
  if (input.coverMediaUuid !== undefined) out.cover_media_uuid = input.coverMediaUuid;
  if (input.status !== undefined) out.status = input.status;
  return out;
}

const EMPTY_PAGE: Paged<never> = { items: [], total: 0, page: 1, lastPage: 1 };

/* ─────────────────────────────── публичные ─────────────────────────────── */

export async function fetchCommunityEvents(
  slug: string,
  when: EventWhen = "upcoming",
  perPage = 20,
): Promise<Paged<ClubEvent>> {
  if (isDemoMode()) return EMPTY_PAGE;
  const res = await api<ApiPage<ApiEvent>>(`/communities/${slug}/events`, {
    query: { when, per_page: perPage },
  });
  return mapPage(res, mapEvent);
}

export async function createCommunityEvent(slug: string, input: EventInput): Promise<ClubEvent> {
  const res = await api<{ data: ApiEvent }>(`/communities/${slug}/events`, {
    method: "POST",
    json: toPayload(input),
  });
  return mapEvent(res.data);
}

export async function fetchPlatformEvents(when: EventWhen = "upcoming"): Promise<Paged<ClubEvent>> {
  const res = await api<ApiPage<ApiEvent>>("/events", { query: { when } });
  return mapPage(res, mapEvent);
}

export async function fetchEvent(uuid: string): Promise<ClubEvent> {
  const res = await api<{ data: ApiEvent }>(`/events/${uuid}`);
  return mapEvent(res.data);
}

export async function fetchEventAttendees(
  uuid: string,
  page = 1,
  perPage = 30,
): Promise<Paged<EventAttendee>> {
  const res = await api<ApiPage<ApiUser>>(`/events/${uuid}/attendees`, {
    query: { page, per_page: perPage },
  });
  return mapPage(res, mapAttendee);
}

export async function updateEvent(uuid: string, input: Partial<EventInput>): Promise<ClubEvent> {
  const res = await api<{ data: ApiEvent }>(`/events/${uuid}`, {
    method: "PATCH",
    json: toPayload(input),
  });
  return mapEvent(res.data);
}

export async function cancelEvent(uuid: string, reason?: string): Promise<ClubEvent> {
  const res = await api<{ data: ApiEvent }>(`/events/${uuid}/cancel`, {
    method: "POST",
    json: { reason: reason || null },
  });
  return mapEvent(res.data);
}

export async function deleteEvent(uuid: string): Promise<void> {
  await api(`/events/${uuid}`, { method: "DELETE" });
}

/** «Пойду». `joined` — человек заодно вступил в открытое сообщество. */
export async function attendEvent(uuid: string): Promise<{ event: ClubEvent; joined: boolean }> {
  const res = await api<{ data: ApiEvent; joined?: boolean }>(`/events/${uuid}/attendance`, {
    method: "POST",
  });
  return { event: mapEvent(res.data), joined: Boolean(res.joined) };
}

export async function unattendEvent(uuid: string): Promise<ClubEvent> {
  const res = await api<{ data: ApiEvent }>(`/events/${uuid}/attendance`, { method: "DELETE" });
  return mapEvent(res.data);
}

/* ──────────────────────────────── админка ──────────────────────────────── */

export type AdminEventStatusFilter =
  "" | "draft" | "published" | "cancelled" | "past" | "upcoming" | "deleted";

export async function adminFetchEvents(filters: {
  scope?: "" | EventScope;
  status?: AdminEventStatusFilter;
  community?: string;
  q?: string;
  page?: number;
}): Promise<Paged<ClubEvent>> {
  const res = await api<ApiPage<ApiEvent>>("/admin/events", {
    query: {
      scope: filters.scope || undefined,
      status: filters.status || undefined,
      community: filters.community?.trim() || undefined,
      q: filters.q?.trim() || undefined,
      page: filters.page ?? 1,
    },
  });
  return mapPage(res, mapEvent);
}

export async function adminCreateEvent(
  input: EventInput & { communitySlug?: string | null },
): Promise<ClubEvent> {
  const res = await api<{ data: ApiEvent }>("/admin/events", {
    method: "POST",
    json: { ...toPayload(input), community_slug: input.communitySlug || null },
  });
  return mapEvent(res.data);
}

export async function adminUpdateEvent(
  uuid: string,
  input: Partial<EventInput>,
): Promise<ClubEvent> {
  const res = await api<{ data: ApiEvent }>(`/admin/events/${uuid}`, {
    method: "PATCH",
    json: toPayload(input),
  });
  return mapEvent(res.data);
}

export async function adminCancelEvent(uuid: string, reason?: string): Promise<ClubEvent> {
  const res = await api<{ data: ApiEvent }>(`/admin/events/${uuid}/cancel`, {
    method: "POST",
    json: { reason: reason || null },
  });
  return mapEvent(res.data);
}

export async function adminDeleteEvent(uuid: string): Promise<void> {
  await api(`/admin/events/${uuid}`, { method: "DELETE" });
}

export async function adminFetchEventAttendees(
  uuid: string,
  page = 1,
): Promise<Paged<EventAttendee>> {
  const res = await api<ApiPage<ApiUser>>(`/admin/events/${uuid}/attendees`, {
    query: { page },
  });
  return mapPage(res, mapAttendee);
}

/* ─────────────────────────────── ошибки ─────────────────────────────── */

/**
 * Разбор ответа сервера для формы: 422 раскладывается по полям,
 * остальное — одной строкой. Поля — те же имена, что у сервера.
 */
export function eventErrors(error: unknown): { fields: Record<string, string>; message: string } {
  if (error instanceof ApiError) {
    const fields: Record<string, string> = {};
    for (const [key, list] of Object.entries(error.errors ?? {})) {
      if (list?.[0]) fields[key] = list[0];
    }
    const first = Object.values(fields)[0];
    if (error.status === 422) return { fields, message: first ?? error.message };
    if (error.status === 403) return { fields, message: error.message || "Недостаточно прав." };
    if (error.status === 404) return { fields, message: "Мероприятие не найдено." };
    if (error.status === 429) return { fields, message: "Слишком часто. Попробуйте через минуту." };
    return { fields, message: error.message || "Не удалось выполнить действие." };
  }
  return { fields: {}, message: "Нет связи с сервером. Попробуйте ещё раз." };
}
