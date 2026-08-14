import { useEffect, useState } from "react";
import { fetchDeliveryMethodsPublic, type DeliveryMethodPublic } from "@/lib/api/site";
import { DELIVERY_METHODS_FALLBACK, type DeliveryMethodOption } from "@/lib/config/deliveryMethods";

let cache: DeliveryMethodOption[] | null = null;
let inflight: Promise<DeliveryMethodOption[]> | null = null;

export function invalidateDeliveryMethodsCache(): void {
  cache = null;
  inflight = null;
}

function toOptions(rows: DeliveryMethodPublic[]): DeliveryMethodOption[] {
  return rows.map((r) => ({ id: r.code, label: r.name, isIntegrated: r.is_integrated }));
}

function loadMethods(): Promise<DeliveryMethodOption[]> {
  if (cache) return Promise.resolve(cache);
  if (inflight) return inflight;
  inflight = fetchDeliveryMethodsPublic()
    .then((rows) => {
      const options = rows.length > 0 ? toOptions(rows) : DELIVERY_METHODS_FALLBACK;
      cache = options;
      return options;
    })
    .catch(() => DELIVERY_METHODS_FALLBACK)
    .finally(() => {
      inflight = null;
    });
  return inflight;
}

export function useDeliveryMethods(): DeliveryMethodOption[] {
  const [methods, setMethods] = useState<DeliveryMethodOption[]>(cache ?? DELIVERY_METHODS_FALLBACK);

  useEffect(() => {
    let active = true;
    void loadMethods().then((rows) => {
      if (active) setMethods(rows);
    });
    return () => {
      active = false;
    };
  }, []);

  return methods;
}
