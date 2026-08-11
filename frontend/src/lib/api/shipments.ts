import { api } from "./client";

export interface ShipmentSummary {
  uuid: string;
  status: string;
  tracking_number: string | null;
  provider: string;
  delivery_cost_cents: number;
}

export async function confirmShipment(uuid: string): Promise<ShipmentSummary> {
  const res = await api<{ data: ShipmentSummary }>(`/shipments/${uuid}/confirm`, {
    method: "POST",
    json: {},
  });
  return res.data;
}

export async function syncShipment(uuid: string): Promise<ShipmentSummary> {
  const res = await api<{ data: ShipmentSummary }>(`/shipments/${uuid}/sync`, {
    method: "POST",
    json: {},
  });
  return res.data;
}
