import { api } from "./client";

export interface EscrowQuote {
  listing_uuid: string;
  item_cents: number;
  delivery_cents: number;
  platform_fee_cents: number;
  seller_payout_cents: number;
  total_cents: number;
  fee_mode: string;
  currency: string;
  provider: string | null;
  max_total_cents?: number;
  can_checkout?: boolean;
  checkout_block_reason?: string | null;
}

export interface EscrowDeal {
  uuid: string;
  listing_uuid: string | null;
  listing_title?: string | null;
  listing_slug?: string | null;
  status: string;
  dispute_status?: string;
  payment_provider: string;
  amount_cents: number;
  item_amount_cents: number;
  delivery_amount_cents: number;
  seller_payout_cents: number;
  platform_fee_cents: number;
  captured_cents?: number;
  refunded_cents?: number;
  paid_out_cents?: number;
  currency: string;
  paid_at: string | null;
  completed_at: string | null;
  frozen: boolean;
  role: "buyer" | "seller" | null;
  can_confirm_receipt: boolean;
  can_cancel: boolean;
  can_open_dispute?: boolean;
  can_mark_shipped?: boolean;
  can_confirm_shipment?: boolean;
  shipment: {
    uuid: string;
    status: string;
    tracking_number: string | null;
    provider: string;
    delivered_at?: string | null;
  } | null;
}

export interface EscrowCheckoutResult {
  escrow_uuid: string;
  checkout_url: string | null;
  status: string;
  provider: string;
}

export interface EscrowDealsPage {
  data: EscrowDeal[];
  meta: { current_page: number; last_page: number; per_page: number; total: number };
}

export async function fetchEscrowQuote(listingUuid: string, deliveryCents = 0): Promise<EscrowQuote> {
  const params = new URLSearchParams({
    listing_uuid: listingUuid,
    delivery_cents: String(deliveryCents),
  });
  const res = await api<{ data: EscrowQuote }>(`/escrow/quote?${params}`);
  return res.data;
}

export async function fetchListingEscrowDeal(listingUuid: string): Promise<EscrowDeal | null> {
  const res = await api<{ data: EscrowDeal | null }>(`/listings/${listingUuid}/escrow/deal`);
  return res.data;
}

export async function fetchEscrowDeal(uuid: string): Promise<EscrowDeal> {
  const res = await api<{ data: EscrowDeal }>(`/escrow/${uuid}`);
  return res.data;
}

export async function fetchMyEscrowDeals(opts: {
  role?: "buyer" | "seller";
  status?: string;
  page?: number;
  perPage?: number;
} = {}): Promise<EscrowDealsPage> {
  const params = new URLSearchParams();
  if (opts.role) params.set("role", opts.role);
  if (opts.status) params.set("status", opts.status);
  if (opts.page) params.set("page", String(opts.page));
  if (opts.perPage) params.set("per_page", String(opts.perPage));
  const qs = params.toString();
  return api<EscrowDealsPage>(`/users/me/escrow-deals${qs ? `?${qs}` : ""}`);
}

export async function startEscrowCheckout(
  listingUuid: string,
  opts: { deliveryAmountCents?: number; shipmentId?: number } = {},
): Promise<EscrowCheckoutResult> {
  const res = await api<{ data: EscrowCheckoutResult }>(`/listings/${listingUuid}/escrow/checkout`, {
    method: "POST",
    json: {
      delivery_amount_cents: opts.deliveryAmountCents ?? 0,
      ...(opts.shipmentId != null ? { shipment_id: opts.shipmentId } : {}),
    },
  });
  return res.data;
}

export async function syncEscrowDeal(uuid: string): Promise<EscrowDeal> {
  const res = await api<{ data: EscrowDeal }>(`/escrow/${uuid}/sync`, { method: "POST", json: {} });
  return res.data;
}

export async function confirmEscrowReceipt(uuid: string): Promise<EscrowDeal> {
  const res = await api<{ data: EscrowDeal }>(`/escrow/${uuid}/confirm-receipt`, { method: "POST", json: {} });
  return res.data;
}

export async function cancelEscrowDeal(uuid: string, reason?: string): Promise<EscrowDeal> {
  const res = await api<{ data: EscrowDeal }>(`/escrow/${uuid}/cancel`, {
    method: "POST",
    json: reason ? { reason } : {},
  });
  return res.data;
}

export async function openEscrowDispute(uuid: string, reason: string): Promise<EscrowDeal> {
  const res = await api<{ data: EscrowDeal }>(`/escrow/${uuid}/open-dispute`, {
    method: "POST",
    json: { reason },
  });
  return res.data;
}

export async function markEscrowShipped(uuid: string, trackingNumber?: string): Promise<EscrowDeal> {
  const res = await api<{ data: EscrowDeal }>(`/escrow/${uuid}/mark-shipped`, {
    method: "POST",
    json: trackingNumber ? { tracking_number: trackingNumber } : {},
  });
  return res.data;
}

export function escrowStatusLabel(status: string): string {
  const map: Record<string, string> = {
    pending_payment: "Ожидает оплаты",
    funded: "Оплачено (холд)",
    paid: "Оплачено",
    awaiting_shipment: "Ждёт отправки",
    in_transit: "В пути",
    delivered: "Доставлено",
    awaiting_buyer_confirm: "Подтвердите получение",
    captured: "Списано",
    payout_pending: "Выплата продавцу",
    completed: "Завершено",
    dispute_open: "Спор",
    frozen: "Заморожено",
    refunding: "Возврат",
    refunded: "Возвращено",
    reversed: "Отменено",
    cancelled: "Отменено",
    failed: "Ошибка",
  };
  return map[status] ?? status;
}

export function shipmentStatusLabel(status: string): string {
  const map: Record<string, string> = {
    created: "Создано",
    quoted: "Рассчитано",
    awaiting_seller: "Ждёт продавца",
    in_transit: "В пути",
    at_pickup: "В пункте выдачи",
    delivered: "Доставлено",
    cancelled: "Отменено",
    error: "Ошибка",
  };
  return map[status] ?? status;
}
