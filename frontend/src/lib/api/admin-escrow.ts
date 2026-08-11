import { api } from "./client";

export interface AdminEscrowStats {
  deals_total: number;
  deals_active: number;
  on_hold_cents: number;
  payout_pending: number;
  disputes_open: number;
  failed_operations_7d: number;
  platform_fee_30d_cents: number;
  deals_by_status: Record<string, number>;
}

export interface AdminEscrowDealRow {
  uuid: string;
  status: string;
  dispute_status: string;
  frozen: boolean;
  payment_provider: string;
  amount_cents: number;
  platform_fee_cents: number;
  seller_payout_cents: number;
  captured_cents: number;
  refunded_cents: number;
  paid_out_cents: number;
  currency: string;
  vtb_order_id: string | null;
  admin_note: string | null;
  created_at: string | null;
  listing: { uuid: string; title: string; slug: string; price_cents: number } | null;
  buyer: { id: number; email: string; display_name: string | null; slug: string | null } | null;
  seller: { id: number; email: string; display_name: string | null; slug: string | null } | null;
  shipment: {
    uuid: string;
    provider: string;
    status: string;
    tracking_number: string | null;
    delivery_cost_cents: number | null;
    destination_point: Record<string, unknown> | null;
    delivered_at: string | null;
    events?: { status: string; message: string | null; occurred_at: string | null }[];
  } | null;
  payment: { uuid: string; provider: string; status: string; provider_payment_id: string | null } | null;
  operations?: AdminEscrowOperation[];
}

export interface AdminEscrowOperation {
  id: number;
  type: string;
  status: string;
  amount_cents: number | null;
  reason: string | null;
  error_message: string | null;
  created_at: string | null;
}

interface Paginated<T> {
  data: T[];
}

function mapDeal(d: AdminEscrowDealRow): AdminEscrowDealRow {
  return d;
}

export async function fetchAdminEscrowStats(): Promise<AdminEscrowStats> {
  const res = await api<{ data: AdminEscrowStats }>("/admin/escrow/stats");
  return res.data;
}

export async function fetchAdminEscrowDeals(opts: {
  status?: string;
  q?: string;
  frozen?: boolean;
  dispute?: string;
} = {}): Promise<AdminEscrowDealRow[]> {
  const params = new URLSearchParams();
  if (opts.status && opts.status !== "all") params.set("status", opts.status);
  if (opts.q) params.set("q", opts.q);
  if (opts.frozen) params.set("frozen", "1");
  if (opts.dispute) params.set("dispute", opts.dispute);
  const qs = params.toString();
  const res = await api<Paginated<AdminEscrowDealRow>>(`/admin/escrow${qs ? `?${qs}` : ""}`);
  return (res.data ?? []).map(mapDeal);
}

export async function fetchAdminEscrowDeal(uuid: string): Promise<AdminEscrowDealRow> {
  const res = await api<{ data: AdminEscrowDealRow }>(`/admin/escrow/${uuid}`);
  return mapDeal(res.data);
}

export async function previewEscrowFee(itemCents: number, deliveryCents = 0): Promise<{
  platform_fee_cents: number;
  seller_payout_cents: number;
  total_cents: number;
  fee_mode: string;
}> {
  const params = new URLSearchParams({
    item_cents: String(itemCents),
    delivery_cents: String(deliveryCents),
  });
  const res = await api<{ data: { platform_fee_cents: number; seller_payout_cents: number; total_cents: number; fee_mode: string } }>(
    `/admin/escrow/fee-preview?${params}`,
  );
  return res.data;
}

export async function adminEscrowAction(
  uuid: string,
  action:
    | "sync-payment"
    | "capture"
    | "reverse"
    | "refund"
    | "payout"
    | "freeze"
    | "unfreeze"
    | "cancel"
    | "resolve-dispute",
  body: Record<string, unknown>,
): Promise<AdminEscrowDealRow> {
  const res = await api<{ data: AdminEscrowDealRow }>(`/admin/escrow/${uuid}/${action}`, {
    method: "POST",
    json: body,
  });
  return mapDeal(res.data);
}

export async function updateAdminEscrowNote(uuid: string, adminNote: string | null): Promise<AdminEscrowDealRow> {
  const res = await api<{ data: AdminEscrowDealRow }>(`/admin/escrow/${uuid}/note`, {
    method: "PATCH",
    json: { admin_note: adminNote },
  });
  return mapDeal(res.data);
}

export async function saveEscrowFeeSettings(settings: Record<string, unknown>[]): Promise<void> {
  await api("/admin/settings", { method: "PATCH", json: { settings } });
}
