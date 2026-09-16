import { api } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import type { SafeDeal, SafeDealRole } from "@/lib/api/safe-deals";

/**
 * Раздел «Сделки»: безопасные и обычные вместе.
 *
 * Обычная сделка — продажа, которую продавец отметил в переписке
 * («Продано этому покупателю»). До 17.09 такой сущности не было: обычные
 * договорённости нигде не учитывались, а вкладка «Сделки» мессенджера и
 * раздел «Безопасные сделки» показывали разное.
 */
export type DealType = "all" | "safe" | "ordinary";

export interface OrdinaryDeal {
  type: "ordinary";
  uuid: string;
  role: SafeDealRole;
  status: "active" | "declined" | "cancelled";
  status_label: string;
  listing_uuid: string | null;
  listing_title: string | null;
  listing_image: string | null;
  amount_kopecks: number;
  counterpart: { id: number; name: string } | null;
  conversation_uuid: string | null;
  created_at: string | null;
  can: { decline: boolean; cancel: boolean };
}

export type DealItem = { kind: "safe"; deal: SafeDeal } | { kind: "ordinary"; deal: OrdinaryDeal };

interface Page<T> {
  data: T[];
  meta?: { last_page?: number };
}

/** Все страницы: список сделок кончается там, где кончаются сделки. */
async function allPages<T>(path: string, role: SafeDealRole): Promise<T[]> {
  const out: T[] = [];
  for (let page = 1; page <= 20; page++) {
    const res = await api<Page<T>>(path, { query: { role, per_page: 50, page } });
    out.push(...(res.data ?? []));
    if (page >= (res.meta?.last_page ?? 1)) break;
  }
  return out;
}

export async function fetchDeals(role: SafeDealRole, type: DealType): Promise<DealItem[]> {
  if (isDemoMode()) return [];
  const [safe, ordinary] = await Promise.all([
    type === "ordinary"
      ? Promise.resolve([] as SafeDeal[])
      : allPages<SafeDeal>("/safe-deals", role),
    type === "safe"
      ? Promise.resolve([] as OrdinaryDeal[])
      : allPages<OrdinaryDeal>("/ordinary-deals", role),
  ]);
  return mergeDeals(safe, ordinary);
}

/** Новые сверху; у безопасной сделки без даты создания — по дате оплаты. */
export function mergeDeals(safe: SafeDeal[], ordinary: OrdinaryDeal[]): DealItem[] {
  const items: DealItem[] = [
    ...safe.map((deal) => ({ kind: "safe" as const, deal })),
    ...ordinary.map((deal) => ({ kind: "ordinary" as const, deal })),
  ];
  const when = (item: DealItem): number => {
    const raw =
      item.kind === "safe" ? (item.deal.created_at ?? item.deal.paid_at) : item.deal.created_at;
    const t = raw ? Date.parse(raw) : NaN;
    return Number.isNaN(t) ? 0 : t;
  };
  return items.sort((a, b) => when(b) - when(a));
}

export async function markListingSold(conversationUuid: string): Promise<OrdinaryDeal> {
  const res = await api<{ data: OrdinaryDeal }>(
    `/conversations/${conversationUuid}/ordinary-deal`,
    {
      method: "POST",
    },
  );
  return res.data;
}

export async function declineOrdinaryDeal(uuid: string): Promise<OrdinaryDeal> {
  const res = await api<{ data: OrdinaryDeal }>(`/ordinary-deals/${uuid}/decline`, {
    method: "POST",
  });
  return res.data;
}

export async function cancelOrdinaryDeal(uuid: string): Promise<OrdinaryDeal> {
  const res = await api<{ data: OrdinaryDeal }>(`/ordinary-deals/${uuid}/cancel`, {
    method: "POST",
  });
  return res.data;
}
