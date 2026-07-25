import { api } from "@/lib/api/client";
import type { FooterContacts } from "@/lib/footer-contacts";

export async function fetchFooterContacts(): Promise<FooterContacts> {
  const res = await api<{ data: FooterContacts }>("/public/footer-contacts", { auth: false });
  return res.data ?? {};
}
