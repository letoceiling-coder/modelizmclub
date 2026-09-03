import { api } from "./client";

export type RuleSectionType = "intro" | "section" | "requisites" | "footer_note";

export interface RuleSection {
  id?: number;
  type: RuleSectionType;
  title?: string | null;
  content: string;
  position: number;
  is_visible?: boolean;
}

export interface RuleDocumentCard {
  slug: string;
  title: string;
  summary?: string | null;
  published_at?: string | null;
  href: string;
}

export interface RulesHubData {
  title: string;
  intro: string;
  published_at?: string | null;
  documents: RuleDocumentCard[];
}

export interface RulePageData {
  slug: string;
  title: string;
  seo_title?: string | null;
  seo_description?: string | null;
  summary?: string | null;
  version: number;
  published_at?: string | null;
  sections: RuleSection[];
}

export interface AdminRulePage extends RulePageData {
  id: number;
  status: "draft" | "published" | "archived";
  sort: number;
  updated_at?: string | null;
}

export interface AdminRulePageRevision {
  id: number;
  version: number;
  title: string;
  status: string;
  created_at?: string | null;
  editor?: string | null;
}

export async function fetchRulesHub(): Promise<RulesHubData> {
  const res = await api<{ data: RulesHubData }>("/rules", { auth: false });
  return res.data;
}

export async function fetchRulePage(slug: string): Promise<RulePageData> {
  const res = await api<{ data: RulePageData }>(`/rules/${slug}`, { auth: false });
  return res.data;
}

export async function adminFetchRulePages(): Promise<AdminRulePage[]> {
  const res = await api<{ data: AdminRulePage[] }>("/admin/rule-pages");
  return res.data;
}

export async function adminFetchRulePage(id: number): Promise<AdminRulePage> {
  const res = await api<{ data: AdminRulePage }>(`/admin/rule-pages/${id}`);
  return res.data;
}

export interface UpsertRulePagePayload {
  slug: string;
  title: string;
  seo_title?: string;
  seo_description?: string;
  summary?: string;
  sort?: number;
  sections?: RuleSection[];
}

export async function adminCreateRulePage(payload: UpsertRulePagePayload): Promise<AdminRulePage> {
  const res = await api<{ data: AdminRulePage }>("/admin/rule-pages", {
    method: "POST",
    json: payload,
  });
  return res.data;
}

export async function adminUpdateRulePage(
  id: number,
  payload: UpsertRulePagePayload,
): Promise<AdminRulePage> {
  const res = await api<{ data: AdminRulePage }>(`/admin/rule-pages/${id}`, {
    method: "PUT",
    json: payload,
  });
  return res.data;
}

export async function adminPublishRulePage(id: number): Promise<AdminRulePage> {
  const res = await api<{ data: AdminRulePage }>(`/admin/rule-pages/${id}/publish`, {
    method: "POST",
  });
  return res.data;
}

export async function adminDuplicateRulePage(id: number): Promise<AdminRulePage> {
  const res = await api<{ data: AdminRulePage }>(`/admin/rule-pages/${id}/duplicate`, {
    method: "POST",
  });
  return res.data;
}

export async function adminDeleteRulePage(id: number): Promise<void> {
  await api(`/admin/rule-pages/${id}`, { method: "DELETE" });
}

export async function adminFetchRulePageRevisions(id: number): Promise<AdminRulePageRevision[]> {
  const res = await api<{ data: AdminRulePageRevision[] }>(`/admin/rule-pages/${id}/revisions`);
  return res.data;
}

export async function adminRestoreRulePageRevision(
  id: number,
  revisionId: number,
): Promise<AdminRulePage> {
  const res = await api<{ data: AdminRulePage }>(
    `/admin/rule-pages/${id}/revisions/${revisionId}/restore`,
    {
      method: "POST",
    },
  );
  return res.data;
}
