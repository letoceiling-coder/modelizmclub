/**
 * Delivery providers for listing wizard. Active list is loaded from
 * GET /public/delivery-methods; integrated carriers (CDEK/Yandex) also
 * have shipment APIs. Pochta/Ozon are selectable labels until APIs connect.
 */
export interface DeliveryMethodOption {
  id: string;
  label: string;
  isIntegrated?: boolean;
}

export const DELIVERY_METHODS_FALLBACK: DeliveryMethodOption[] = [
  { id: "cdek", label: "СДЭК", isIntegrated: true },
  { id: "yandex", label: "Яндекс Доставка", isIntegrated: true },
  { id: "pochta", label: "Почта России", isIntegrated: false },
  { id: "ozon", label: "Ozon", isIntegrated: false },
];

/** @deprecated use useDeliveryMethods() */
export const DELIVERY_METHODS: DeliveryMethodOption[] = DELIVERY_METHODS_FALLBACK;

/** Always offered in the buyer picker alongside whatever the seller ticked. */
export const SELF_PICKUP_LABEL = "Самовывоз / при встрече";
