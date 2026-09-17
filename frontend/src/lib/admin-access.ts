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
export interface AdminAccess {
  role: "admin" | "moderator";
  /** Владелец: всё, включая роли, цены и платежи. */
  isOwner: boolean;
  sections: string[];
}

let current: AdminAccess | null = null;
const listeners = new Set<() => void>();

export function setAdminAccess(next: AdminAccess | null): void {
  current = next;
  listeners.forEach((cb) => cb());
}

export async function fetchAdminAccess(): Promise<AdminAccess> {
  const res = await api<{
    data: { role: "admin" | "moderator"; is_owner: boolean; sections: string[] };
  }>("/admin/access");
  return { role: res.data.role, isOwner: res.data.is_owner, sections: res.data.sections };
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
