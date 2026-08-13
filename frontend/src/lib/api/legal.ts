import { api } from "./client";

export interface LegalPageData {
  slug: string;
  title: string;
  content_html: string;
  version: number;
  published_at?: string | null;
}

export interface FooterLinkItem {
  id: number;
  label: string;
  target_type: "internal" | "external";
  target_value: string;
  sort: number;
}

export type FooterLinksGrouped = Record<string, FooterLinkItem[]>;

export interface ConsentRecord {
  type: string;
  doc_version: string;
  status: "granted" | "revoked";
  created_at?: string | null;
}

export interface CookiePreferencesPayload {
  anonymous_key?: string;
  analytics: boolean;
  ads: boolean;
}

export async function fetchLegalPage(slug: string): Promise<LegalPageData> {
  const res = await api<{ data: LegalPageData }>(`/legal/${slug}`, { auth: false });
  return res.data;
}

export async function fetchFooterLinks(): Promise<FooterLinksGrouped> {
  const res = await api<{ data: FooterLinksGrouped }>("/footer-links", { auth: false });
  return res.data;
}

export async function saveCookiePreferences(payload: CookiePreferencesPayload): Promise<void> {
  await api("/cookie-preferences", { method: "POST", auth: false, json: payload });
}

export async function fetchMyConsents(): Promise<ConsentRecord[]> {
  const res = await api<{ data: ConsentRecord[] }>("/me/consents");
  return res.data;
}

export async function revokeConsent(type: string): Promise<void> {
  await api(`/consents/${type}/revoke`, { method: "POST" });
}

export async function exportMyData(): Promise<Record<string, unknown>> {
  const res = await api<{ data: Record<string, unknown> }>("/me/data/export");
  return res.data;
}

export async function deleteMyAccount(): Promise<void> {
  await api("/me", { method: "DELETE", json: { confirm: true } });
}

// --- Admin ---

export interface AdminLegalPage extends LegalPageData {
  id: number;
  status: "draft" | "published" | "archived";
  updated_at?: string | null;
}

export async function adminFetchLegalPages(): Promise<AdminLegalPage[]> {
  const res = await api<{ data: AdminLegalPage[] }>("/admin/legal-pages");
  return res.data;
}

export async function adminUpdateLegalPage(id: number, payload: { slug: string; title: string; content_html: string }): Promise<AdminLegalPage> {
  const res = await api<{ data: AdminLegalPage }>(`/admin/legal-pages/${id}`, { method: "PUT", json: payload });
  return res.data;
}

export async function adminPublishLegalPage(id: number): Promise<AdminLegalPage> {
  const res = await api<{ data: AdminLegalPage }>(`/admin/legal-pages/${id}/publish`, { method: "POST" });
  return res.data;
}

export async function adminArchiveLegalPage(id: number): Promise<AdminLegalPage> {
  const res = await api<{ data: AdminLegalPage }>(`/admin/legal-pages/${id}/archive`, { method: "POST" });
  return res.data;
}

export interface AdminFooterLink extends FooterLinkItem {
  group: string;
  is_visible: boolean;
}

export async function adminFetchFooterLinks(): Promise<AdminFooterLink[]> {
  const res = await api<{ data: AdminFooterLink[] }>("/admin/footer-links");
  return res.data;
}

export async function adminUpsertFooterLink(id: number | null, payload: Partial<AdminFooterLink>): Promise<AdminFooterLink> {
  if (id) {
    const res = await api<{ data: AdminFooterLink }>(`/admin/footer-links/${id}`, { method: "PUT", json: payload });
    return res.data;
  }
  const res = await api<{ data: AdminFooterLink }>("/admin/footer-links", { method: "POST", json: payload });
  return res.data;
}

export async function adminDeleteFooterLink(id: number): Promise<void> {
  await api(`/admin/footer-links/${id}`, { method: "DELETE" });
}

export async function adminReorderFooterLinks(items: { id: number; sort: number }[]): Promise<void> {
  await api("/admin/footer-links/reorder", { method: "POST", json: { items } });
}
