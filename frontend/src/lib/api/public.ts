import { apiRequest } from "./client";
import type { Banner, FaqCategory } from "@/lib/types";

export async function fetchBanners(placement = "feed"): Promise<Banner[]> {
  const res = await apiRequest<{ data: Array<{ id: number; title: string; text?: string; link_url?: string; placement?: string }> }>(
    `/public/banners?placement=${encodeURIComponent(placement)}`,
  );
  return (res.data ?? []).map((b) => ({
    id: String(b.id),
    title: b.title,
    text: b.text,
    linkUrl: b.link_url,
    placement: b.placement,
  }));
}

export async function fetchFaq(): Promise<FaqCategory[]> {
  const res = await apiRequest<{ data: FaqCategory[] }>("/public/faq");
  return res.data ?? [];
}

export async function fetchPublicStats(): Promise<{ firstHundred: { taken: number; total: number } }> {
  const res = await apiRequest<{ data: { first_hundred: { taken: number; total: number } } }>("/public/stats");
  const s = res.data?.first_hundred ?? { taken: 0, total: 100 };
  return { firstHundred: s };
}
