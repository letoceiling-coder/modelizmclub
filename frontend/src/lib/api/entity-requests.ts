import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import {
  demoEntityRequests,
  demoMyEntityRequests,
  demoDecideEntityRequest,
  demoCommunityCategories,
} from "@/lib/demo-data";

export type EntityKind = "channel" | "community";
export type RequestStatus = "pending" | "approved" | "rejected";

export interface EntityRequest {
  id: string;
  kind: EntityKind;
  proposedName: string;
  description: string | null;
  category: string;
  status: RequestStatus;
  createdAt: string;
  applicant: { id: string; name: string; slug?: string };
}

export interface CommunityCategoryOption {
  id: number;
  name: string;
  slug: string;
}

const KIND_SEGMENT: Record<EntityKind, string> = {
  community: "communities",
  channel: "channels",
};

export async function fetchCommunityCategories(): Promise<CommunityCategoryOption[]> {
  if (isDemoMode()) return demoCommunityCategories();
  const res = await api<{ data: { id: number; name: string; slug: string }[] }>(
    "/categories/communities",
  );
  return (res.data ?? []).map((c) => ({ id: c.id, name: c.name, slug: c.slug }));
}

export interface ApplyCommunityInput {
  proposedName: string;
  description?: string;
  categoryId?: number;
  cityId?: number | null;
  postCategoryIds?: number[];
  customCategory?: string;
  rules?: string;
  accessType?: "open" | "request";
  contacts?: { telegram?: string; website?: string; phone?: string };
  avatarMediaUuid?: string | null;
  coverMediaUuid?: string | null;
}

export async function applyCommunity(input: ApplyCommunityInput): Promise<void> {
  if (isDemoMode()) return;
  await api("/communities/apply", {
    method: "POST",
    json: {
      proposed_name: input.proposedName,
      description: input.description || null,
      category_id: input.categoryId || null,
      city_id: input.cityId ?? null,
      post_category_ids: input.postCategoryIds ?? [],
      custom_category: input.customCategory || null,
      rules: input.rules || null,
      access_type: input.accessType ?? "open",
      contacts: input.contacts ?? null,
      avatar_media_uuid: input.avatarMediaUuid ?? null,
      cover_media_uuid: input.coverMediaUuid ?? null,
    },
  });
}

export async function applyChannel(input: {
  name: string;
  description?: string;
  category: string;
  slug?: string;
  kind?: string;
  comments_enabled?: boolean;
  avatar_media_uuid?: string | null;
  banner_media_uuid?: string | null;
}): Promise<void> {
  if (isDemoMode()) return;
  await api("/channels/apply", {
    method: "POST",
    json: {
      name: input.name,
      description: input.description || null,
      category: input.category,
      slug: input.slug || null,
      kind: input.kind || null,
      comments_enabled: input.comments_enabled ?? true,
      avatar_media_uuid: input.avatar_media_uuid ?? null,
      banner_media_uuid: input.banner_media_uuid ?? null,
    },
  });
}

export async function fetchMyEntityRequests(): Promise<EntityRequest[]> {
  if (isDemoMode()) return demoMyEntityRequests();
  const res = await api<{ data: EntityRequest[] }>("/me/entity-requests");
  return res.data ?? [];
}

export async function fetchEntityRequests(status?: RequestStatus): Promise<EntityRequest[]> {
  if (isDemoMode()) return demoEntityRequests(status);
  const [communities, channels] = await Promise.all([
    api<{ data: EntityRequest[] }>("/admin/communities/applications", { query: { status } }).catch(
      () => ({ data: [] as EntityRequest[] }),
    ),
    api<{ data: EntityRequest[] }>("/admin/channels/applications", { query: { status } }).catch(
      () => ({ data: [] as EntityRequest[] }),
    ),
  ]);
  return [...(communities.data ?? []), ...(channels.data ?? [])];
}

export async function approveEntityRequest(kind: EntityKind, id: string): Promise<void> {
  if (isDemoMode()) {
    demoDecideEntityRequest(id);
    return;
  }
  await api(`/admin/${KIND_SEGMENT[kind]}/applications/${id}/approve`, { method: "POST" });
}

export async function rejectEntityRequest(
  kind: EntityKind,
  id: string,
  reason?: string,
): Promise<void> {
  if (isDemoMode()) {
    demoDecideEntityRequest(id);
    return;
  }
  await api(`/admin/${KIND_SEGMENT[kind]}/applications/${id}/reject`, {
    method: "POST",
    json: { reason },
  });
}
