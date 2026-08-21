import { api } from "./client";

export interface FaqArticle {
  id: number;
  question: string;
  answer: string;
}

export interface FaqCategory {
  id: number;
  slug: string;
  name: string;
  articles: FaqArticle[];
}

export async function fetchFaq(): Promise<FaqCategory[]> {
  const res = await api<{ data: FaqCategory[] }>("/public/faq", { auth: false });
  return res.data ?? [];
}

export async function fetchLandingFaq(): Promise<{ name: string | null; articles: FaqArticle[] }> {
  const res = await api<{ data: FaqCategory[] }>("/public/faq?category=landing", { auth: false });
  const cat = res.data?.[0];
  return { name: cat?.name ?? null, articles: cat?.articles ?? [] };
}

export interface FirstHundredStats {
  taken: number;
  total: number;
  enabled?: boolean;
}

export interface ReferralProgramStats {
  enabled: boolean;
  perInvite: number;
  maxBonus: number;
}

export async function fetchStats(): Promise<{ firstHundred: FirstHundredStats; referral?: ReferralProgramStats }> {
  const res = await api<{
    data: {
      first_hundred?: { taken?: number; total?: number; enabled?: boolean };
      referral?: { enabled?: boolean; per_invite?: number; max_bonus?: number };
    };
  }>(
    "/public/stats",
    { auth: false },
  );
  const fh = res.data?.first_hundred ?? {};
  const ref = res.data?.referral ?? {};
  return {
    firstHundred: {
      taken: fh.taken ?? 0,
      total: fh.total ?? 0,
      enabled: fh.enabled ?? false,
    },
    referral: {
      enabled: ref.enabled ?? false,
      perInvite: ref.per_invite ?? 0,
      maxBonus: ref.max_bonus ?? 0,
    },
  };
}
