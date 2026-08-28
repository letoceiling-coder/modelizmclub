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
  if (landingFaqCache) return landingFaqCache;
  try {
    const { startPublicBootstrap } = await import("./bootstrap");
    const boot = await startPublicBootstrap();
    if (boot?.landing_faq) {
      seedLandingFaq(boot.landing_faq);
      return landingFaqCache ?? { name: null, articles: [] };
    }
  } catch {
    /* dedicated endpoint below */
  }
  const res = await api<{ data: FaqCategory[] }>("/public/faq?category=landing", { auth: false });
  seedLandingFaq(res.data ?? []);
  return landingFaqCache ?? { name: null, articles: [] };
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

let statsCache: { firstHundred: FirstHundredStats; referral?: ReferralProgramStats } | null = null;
let landingFaqCache: { name: string | null; articles: FaqArticle[] } | null = null;

export function seedStats(data: {
  firstHundred: FirstHundredStats;
  referral?: ReferralProgramStats;
}): void {
  statsCache = data;
}

export function getCachedStats(): { firstHundred: FirstHundredStats; referral?: ReferralProgramStats } | null {
  return statsCache;
}

export function seedLandingFaq(categories: FaqCategory[]): void {
  const cat = categories[0];
  landingFaqCache = { name: cat?.name ?? null, articles: cat?.articles ?? [] };
}

export function getCachedLandingFaq(): { name: string | null; articles: FaqArticle[] } | null {
  return landingFaqCache;
}

export async function fetchStats(): Promise<{ firstHundred: FirstHundredStats; referral?: ReferralProgramStats }> {
  if (statsCache) return statsCache;
  try {
    const { startPublicBootstrap } = await import("./bootstrap");
    const boot = await startPublicBootstrap();
    if (boot?.stats) {
      const fh = boot.stats.first_hundred ?? {};
      const ref = boot.stats.referral ?? {};
      statsCache = {
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
      return statsCache;
    }
  } catch {
    /* dedicated endpoint below */
  }
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
  statsCache = {
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
  return statsCache;
}
