import { api } from "./client";

/**
 * Пункт отправки продавца — откуда он сдаёт посылку в СДЭК.
 *
 * Ручки существовали с самого начала, но фронтенд их не звал: на 22.09
 * в `seller_delivery_profiles` было ноль строк при девятнадцати
 * отправлениях. Из-за этого заказ уезжал к перевозчику без
 * `shipment_point` и падал там.
 */
export interface SellerDeliveryProfile {
  id: number;
  provider: string;
  point_type: string;
  external_point_id: string;
  label: string | null;
  address: Record<string, unknown> | null;
  is_default: boolean;
  is_active: boolean;
  meta: Record<string, unknown> | null;
}

export async function fetchSellerDeliveryProfiles(): Promise<SellerDeliveryProfile[]> {
  const res = await api<{ data: SellerDeliveryProfile[] }>("/users/me/delivery-profile");
  return res.data ?? [];
}

export interface SaveSellerPointInput {
  externalPointId: string;
  label: string;
  address: string | null;
  cityCode: number;
  latitude?: number | null;
  longitude?: number | null;
}

export async function saveSellerCdekPoint(
  input: SaveSellerPointInput,
): Promise<SellerDeliveryProfile> {
  const res = await api<{ data: SellerDeliveryProfile }>("/users/me/delivery-profile", {
    method: "POST",
    json: {
      provider: "cdek",
      point_type: "pickup_point",
      external_point_id: input.externalPointId,
      label: input.label,
      // `city_code` читается снимком точки из `meta`, а при его отсутствии
      // из `address` — кладём в оба, чтобы снимок собрался при любом из
      // двух путей чтения.
      address: {
        address: input.address,
        city_code: input.cityCode,
      },
      meta: {
        city_code: input.cityCode,
        latitude: input.latitude ?? null,
        longitude: input.longitude ?? null,
      },
      is_default: true,
    },
  });
  return res.data;
}

export async function deleteSellerDeliveryProfile(id: number): Promise<void> {
  await api(`/users/me/delivery-profile/${id}`, { method: "DELETE" });
}
