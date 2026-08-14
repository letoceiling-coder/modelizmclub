import { api } from "@/lib/api/client";
import type { FooterContacts } from "@/lib/footer-contacts";

export interface SiteBranding {
  logo_url?: string;
  footer_logo_url?: string;
  header_size: number;
  footer_size: number;
}

export interface SiteBrandingDraft {
  header_media_uuid: string | null;
  footer_media_uuid: string | null;
  header_size: number;
  footer_size: number;
}

export interface DeliveryMethodPublic {
  code: string;
  name: string;
  is_integrated: boolean;
}

export async function fetchFooterContacts(): Promise<FooterContacts> {
  const res = await api<{ data: FooterContacts }>("/public/footer-contacts", { auth: false });
  return res.data ?? {};
}

export async function fetchSiteBranding(): Promise<SiteBranding> {
  const res = await api<{ data: SiteBranding }>("/public/branding", { auth: false });
  return res.data ?? { header_size: 48, footer_size: 36 };
}

export async function fetchDeliveryMethodsPublic(): Promise<DeliveryMethodPublic[]> {
  const res = await api<{ data: DeliveryMethodPublic[] }>("/public/delivery-methods", { auth: false });
  return res.data ?? [];
}

export const BRANDING_SETTING_KEY = "branding.logo";
