import { useEffect, useState } from "react";
import { api, getToken } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { PUBLIC_ORIGIN } from "@/lib/referral";

export interface ReferralInvitedUser {
  uuid: string;
  displayName: string;
  slug: string | null;
  avatar: string | null;
}

export interface ReferralInvite {
  user: ReferralInvitedUser;
  joinedAt: string;
}

export interface ReferralData {
  code: string;
  link: string;
  invited: ReferralInvite[];
  invitedCount: number;
  bonus: number;
  listingCredits: number;
  maxBonus: number;
  perInvite: number;
  enabled: boolean;
}

interface ApiReferral {
  code?: string;
  invited?: Array<{
    user?: { uuid?: string; display_name?: string | null; slug?: string | null; avatar?: string | null };
    joined_at?: string;
  }>;
  invited_count?: number;
  bonus?: number;
  listing_credits?: number;
  max_bonus?: number;
  per_invite?: number;
  enabled?: boolean;
}

export function referralLinkFor(code: string): string {
  return code ? `${PUBLIC_ORIGIN}/register?ref=${code}` : PUBLIC_ORIGIN;
}

export async function fetchReferral(): Promise<ReferralData> {
  const res = await api<{ data: ApiReferral }>("/users/me/referrals");
  const d = res.data ?? {};
  return {
    code: d.code ?? "",
    link: referralLinkFor(d.code ?? ""),
    invited: (d.invited ?? []).map((i) => ({
      user: {
        uuid: i.user?.uuid ?? "",
        displayName: i.user?.display_name ?? "Пользователь",
        slug: i.user?.slug ?? null,
        avatar: i.user?.avatar ?? null,
      },
      joinedAt: i.joined_at ?? "",
    })),
    invitedCount: d.invited_count ?? 0,
    bonus: d.bonus ?? 0,
    listingCredits: d.listing_credits ?? 0,
    maxBonus: d.max_bonus ?? 10,
    perInvite: d.per_invite ?? 1,
    enabled: d.enabled ?? true,
  };
}

export function useReferral(): { data: ReferralData | null; loading: boolean } {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    if (!getToken() && !isDemoMode()) {
      setLoading(false);
      return;
    }
    let active = true;
    fetchReferral()
      .then((d) => active && setData(d))
      .catch(() => {})
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, []);
  return { data, loading };
}
