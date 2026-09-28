import { api } from "./client";

/**
 * Раздел «Роли и доступ» (Владелец): сводка сотрудников, их льготы и
 * направления, что открывает каждая роль. Правки идут через маршруты
 * пользователя — роль и льготы, направления, кредиты.
 */

export type StaffRole = "owner" | "moderator" | "category_admin" | "user";

export interface Privileges {
  subscriptionExempt: boolean;
  freeListingsQuota: number;
  freeListingsUnlimited: boolean;
}

export interface DirectionRef {
  id: number;
  name: string;
  slug: string;
}

export interface StaffMember extends Privileges {
  uuid: string;
  name: string;
  email: string;
  role: StaffRole;
  status: string | null;
  freeListingsUsed: number;
  listingCredits: number;
  categories: DirectionRef[];
  /** Разделы, выданные отдельно поверх роли (C3). Пусто — «только роль». */
  grantedSections: string[];
  /** Что даёт сама роль — по всем ключам, включая служебные. */
  roleSections: string[];
}

export interface RoleSummary {
  role: StaffRole;
  defaults: Privileges;
  sections: string[];
}

export interface RolesOverview {
  staff: StaffMember[];
  roles: RoleSummary[];
  sectionLevels: Record<string, StaffRole>;
  /** Что вообще можно выдать галочкой: список приходит с сервера. */
  grantableSections: string[];
  /**
   * Действующая карта «что открывает роль»: роль → ключ → открыт ли.
   *
   * Это не только разделы меню: править надо и служебные ключи — жалобы,
   * удаление записей, цены размещения. Правится и присылается обратно
   * целиком, а сервер хранит только отличия от зашитых умолчаний.
   */
  roleAccess: Record<string, Record<string, boolean>>;
  /** Клетки, которые нельзя выключить: роль → ключи. */
  roleAccessLocked: Record<string, string[]>;
  maxPerCategory: number;
}

interface ApiPrivileges {
  subscription_exempt: boolean;
  free_listings_quota: number;
  free_listings_unlimited: boolean;
}

interface ApiStaff extends ApiPrivileges {
  uuid: string;
  name: string;
  email: string;
  role: StaffRole;
  status: string | null;
  free_listings_used: number;
  listing_placement_credits: number;
  categories: DirectionRef[];
  granted_sections?: string[];
  role_sections: string[];
}

function mapPrivileges(p: ApiPrivileges): Privileges {
  return {
    subscriptionExempt: p.subscription_exempt === true,
    freeListingsQuota: Number(p.free_listings_quota ?? 0),
    freeListingsUnlimited: p.free_listings_unlimited === true,
  };
}

export async function fetchRolesOverview(): Promise<RolesOverview> {
  const res = await api<{
    data: {
      staff: ApiStaff[];
      roles: Array<{ role: StaffRole; defaults: ApiPrivileges; sections: string[] }>;
      section_levels: Record<string, StaffRole>;
      grantable_sections?: string[];
      role_access?: Record<string, Record<string, boolean>>;
      role_access_locked?: Record<string, string[]>;
      max_per_category: number;
    };
  }>("/admin/roles");
  const d = res.data;
  return {
    staff: d.staff.map((s) => ({
      ...mapPrivileges(s),
      uuid: s.uuid,
      name: s.name,
      email: s.email,
      role: s.role,
      status: s.status,
      freeListingsUsed: s.free_listings_used,
      listingCredits: s.listing_placement_credits,
      categories: s.categories,
      grantedSections: s.granted_sections ?? [],
      roleSections: s.role_sections,
    })),
    roles: d.roles.map((r) => ({
      role: r.role,
      defaults: mapPrivileges(r.defaults),
      sections: r.sections,
    })),
    sectionLevels: d.section_levels,
    grantableSections: d.grantable_sections ?? [],
    roleAccess: d.role_access ?? {},
    roleAccessLocked: d.role_access_locked ?? {},
    maxPerCategory: d.max_per_category,
  };
}

/**
 * Сохранить карту «что открывает роль».
 *
 * Отдаём то, что стоит на экране, целиком; сервер сворачивает к отличиям от
 * зашитых умолчаний и возвращает список изменённых клеток — его и показываем
 * человеку, чтобы «сохранено» не было единственным, что он увидит.
 */
export async function saveRoleAccess(access: Record<string, Record<string, boolean>>): Promise<{
  access: Record<string, Record<string, boolean>>;
  changed: Array<{ role: string; key: string; from: boolean; to: boolean; section: boolean }>;
}> {
  const res = await api<{
    data: {
      access: Record<string, Record<string, boolean>>;
      changed: Array<{ role: string; key: string; from: boolean; to: boolean; section: boolean }>;
    };
  }>("/admin/roles/access", { method: "PUT", json: { access } });

  return res.data;
}

/** Роль и/или льготы. Смена роли без явных льгот выставляет их по умолчанию. */
export async function updateStaff(
  uuid: string,
  patch: Partial<Privileges> & { role?: StaffRole; freeListingsUsed?: number },
): Promise<void> {
  const json: Record<string, unknown> = {};
  if (patch.role !== undefined) json.role = patch.role;
  if (patch.subscriptionExempt !== undefined) json.subscription_exempt = patch.subscriptionExempt;
  if (patch.freeListingsQuota !== undefined) json.free_listings_quota = patch.freeListingsQuota;
  if (patch.freeListingsUnlimited !== undefined)
    json.free_listings_unlimited = patch.freeListingsUnlimited;
  if (patch.freeListingsUsed !== undefined) json.free_listings_used = patch.freeListingsUsed;
  await api(`/admin/users/${uuid}`, { method: "PATCH", json });
}

export async function setStaffCategories(uuid: string, categoryIds: number[]): Promise<void> {
  await api(`/admin/users/${uuid}/categories`, {
    method: "PUT",
    json: { category_ids: categoryIds },
  });
}

export async function updateCategoryAdminLimit(value: number): Promise<number> {
  const res = await api<{ data: { max_per_category: number } }>(
    "/admin/roles/category-admin-limit",
    { method: "PUT", json: { value } },
  );
  return res.data.max_per_category;
}

/** Порядок одного ряда прав. Список присылается целиком: чего в нём нет — то отзывается. */
export async function saveStaffPermissions(uuid: string, sections: string[]): Promise<void> {
  await api(`/admin/roles/permissions/${uuid}`, { method: "PUT", json: { sections } });
}
