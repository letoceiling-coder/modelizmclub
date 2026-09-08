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

/** Карточка документа в хабе. `planned` — документ нужен, но его ещё нет. */
export interface RuleHubItem {
  title: string;
  summary?: string | null;
  href: string | null;
  published_at?: string | null;
  state: "ready" | "planned";
}

export interface RuleHubGroup {
  key: string;
  title: string;
  description: string;
  items: RuleHubItem[];
}

export interface RulesHubData {
  title: string;
  intro: string;
  published_at?: string | null;
  documents: RuleDocumentCard[];
  /** Раскладка по смыслу. Старый плоский `documents` оставлен для совместимости. */
  groups?: RuleHubGroup[];
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

/**
 * Стоимость платных услуг.
 *
 * Все цены — в копейках и из тех же настроек, что и оплата. В тексте
 * документа их набирать нельзя: разойдутся при первом изменении тарифа, а на
 * страницу тарифов ссылается оферта и банк-эквайер.
 */
export interface TariffPlan {
  slug: string;
  name: string;
  price_cents: number;
  period_days: number;
  features: string[];
}

export interface TariffBoost {
  id: string;
  label: string;
  days: number;
  price_cents: number;
}

export interface TariffsData {
  subscriptions: TariffPlan[];
  placement: {
    without_subscription_cents: number;
    with_subscription_cents: number;
    guest_cents: number;
  };
  boost: TariffBoost[];
  safe_deal: {
    enabled: boolean;
    percent: number;
    min_cents: number;
    max_cents: number | null;
    base: string;
  };
  currency: string;
}

export async function fetchTariffs(): Promise<TariffsData> {
  const res = await api<{ data: TariffsData }>("/public/tariffs", { auth: false });
  return res.data;
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
