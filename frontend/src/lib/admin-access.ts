import { useSyncExternalStore } from "react";
import { api } from "@/lib/api/client";

/**
 * Доступ сотрудника к админке — по той же карте, что охраняет маршруты
 * (backend App\Support\AdminAccess, GET /admin/access).
 *
 * До 17.09 меню держало свой список ролей по разделам, а сервер — свой, и
 * они расходились: заявки сообществ и каналов сервер модератору отдавал,
 * меню прятало. Теперь меню строится из ответа сервера.
 */
export interface AdminCategory {
  id: number;
  name: string;
  slug: string;
}

export interface AdminAccess {
  role: "owner" | "moderator" | "category_admin";
  /** Владелец: всё, включая роли, цены и платежи. */
  isOwner: boolean;
  sections: string[];
  /** Служебные права без пункта меню: reports, posts.delete, listings.delete… */
  capabilities: string[];
  /** Направления администратора направления; у остальных пусто. */
  categories: AdminCategory[];
}

let current: AdminAccess | null = null;
const listeners = new Set<() => void>();

export function setAdminAccess(next: AdminAccess | null): void {
  current = next;
  listeners.forEach((cb) => cb());
}

export async function fetchAdminAccess(): Promise<AdminAccess> {
  const res = await api<{
    data: {
      role: AdminAccess["role"];
      is_owner: boolean;
      sections: string[];
      capabilities?: string[];
      categories?: AdminCategory[];
    };
  }>("/admin/access");
  return {
    role: res.data.role,
    isOwner: res.data.is_owner,
    sections: res.data.sections,
    capabilities: res.data.capabilities ?? [],
    categories: res.data.categories ?? [],
  };
}

export function useAdminAccess(): AdminAccess | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => current,
    () => null,
  );
}

/**
 * Кому объяснять пустые разделы: только администратору направления и
 * только пока направлений ноль.
 *
 * Право на разделы даёт роль, а не список направлений, поэтому он входит
 * в админку, а `CategoryScope` подставляет в запросы пустую выборку.
 * Владельцу и модератору объяснять нечего — такого ограничения у них
 * нет. Пока карта прав не приехала (`null`), молчим: плашка, мигнувшая
 * и исчезнувшая, хуже отсутствующей.
 *
 * Живёт здесь, а не в компоненте: чистое условие проверяется без
 * загрузки разметки и всей её цепочки зависимостей.
 */
export function shouldExplainEmptyDirections(access: AdminAccess | null): boolean {
  return access !== null && access.role === "category_admin" && access.categories.length === 0;
}
