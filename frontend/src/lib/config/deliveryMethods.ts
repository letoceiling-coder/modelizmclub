/**
 * Real, backend-connected delivery providers only (CDEK/Yandex have a
 * profile+pickup-point+quote domain in the backend OpenAPI spec — see
 * backend-endpoints-needed.md #21). The wizard previously also listed
 * "Почта России"/Ozon/Wildberries as decorative labels with zero backend
 * integration; dropped so the buyer-side picker never offers a method with
 * nothing behind it.
 */
export interface DeliveryMethod {
  id: "cdek" | "yandex";
  label: string;
}

export const DELIVERY_METHODS: DeliveryMethod[] = [
  { id: "cdek", label: "СДЭК" },
  { id: "yandex", label: "Яндекс Доставка" },
];

/** Always offered in the buyer picker alongside whatever the seller ticked. */
export const SELF_PICKUP_LABEL = "Самовывоз / при встрече";
