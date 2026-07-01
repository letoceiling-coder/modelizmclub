import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { demoFaq, demoStats } from "@/lib/demo-data";

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
  if (isDemoMode()) return demoFaq();
  const res = await api<{ data: FaqCategory[] }>("/public/faq", { auth: false });
  return res.data ?? [];
}

export interface FirstHundredStats {
  taken: number;
  total: number;
}

export async function fetchStats(): Promise<{ firstHundred: FirstHundredStats }> {
  if (isDemoMode()) return demoStats();
  const res = await api<{ data: { first_hundred?: { taken?: number; total?: number } } }>(
    "/public/stats",
    { auth: false },
  );
  const fh = res.data?.first_hundred ?? {};
  return { firstHundred: { taken: fh.taken ?? 0, total: fh.total ?? 100 } };
}
