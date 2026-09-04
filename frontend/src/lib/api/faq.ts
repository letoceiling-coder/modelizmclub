import { api } from "./client";

export interface AdminFaqArticle {
  id: number;
  category_id: number;
  question: string;
  answer: string;
  sort_order: number;
  is_active: boolean;
}

export interface AdminFaqCategory {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  articles: AdminFaqArticle[];
}

export async function adminFetchFaq(): Promise<AdminFaqCategory[]> {
  const res = await api<{ data: AdminFaqCategory[] }>("/admin/faq");
  return res.data ?? [];
}

export async function adminCreateFaqCategory(payload: {
  name: string;
  slug: string;
  sort_order?: number;
  is_active?: boolean;
}): Promise<AdminFaqCategory> {
  const res = await api<{ data: AdminFaqCategory }>("/admin/faq/categories", {
    method: "POST",
    json: payload,
  });
  return res.data;
}

export async function adminUpdateFaqCategory(
  id: number,
  payload: Partial<{ name: string; slug: string; sort_order: number; is_active: boolean }>,
): Promise<AdminFaqCategory> {
  const res = await api<{ data: AdminFaqCategory }>(`/admin/faq/categories/${id}`, {
    method: "PATCH",
    json: payload,
  });
  return res.data;
}

export async function adminDeleteFaqCategory(id: number): Promise<void> {
  await api(`/admin/faq/categories/${id}`, { method: "DELETE" });
}

export async function adminCreateFaqArticle(payload: {
  category_id: number;
  question: string;
  answer: string;
  sort_order?: number;
  is_active?: boolean;
}): Promise<AdminFaqArticle> {
  const res = await api<{ data: AdminFaqArticle }>("/admin/faq/articles", {
    method: "POST",
    json: payload,
  });
  return res.data;
}

export async function adminUpdateFaqArticle(
  id: number,
  payload: Partial<{
    category_id: number;
    question: string;
    answer: string;
    sort_order: number;
    is_active: boolean;
  }>,
): Promise<AdminFaqArticle> {
  const res = await api<{ data: AdminFaqArticle }>(`/admin/faq/articles/${id}`, {
    method: "PATCH",
    json: payload,
  });
  return res.data;
}

export async function adminDeleteFaqArticle(id: number): Promise<void> {
  await api(`/admin/faq/articles/${id}`, { method: "DELETE" });
}

export async function adminReorderFaqArticles(
  items: { id: number; sort_order: number }[],
): Promise<void> {
  await api("/admin/faq/articles/reorder", { method: "POST", json: { items } });
}
