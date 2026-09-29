import { useEffect, useState } from "react";
import { api, getToken } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { publicOrigin } from "@/lib/referral";
import { reportReadFailure } from "@/lib/errors/handle";

export type ReferralInviteStatus = "pending" | "completed";

export interface ReferralInvitedUser {
  uuid: string;
  displayName: string;
  slug: string | null;
  avatar: string | null;
}

export interface ReferralInvite {
  user: ReferralInvitedUser;
  joinedAt: string;
  status: ReferralInviteStatus;
  /** Сколько баллов принесло это приглашение. */
  points: number;
  /** Старые приглашения помнят штуки размещений — их не переписываем. */
  listingCredits: number;
  /** И дни подписки — третий канал награды до 28.09. */
  subscriptionDays: number;
}

export interface ReferralData {
  code: string;
  link: string;
  invited: ReferralInvite[];
  invitedCount: number;
  clicks: number;
  verified: number;
  /** Баллов заработано приглашениями — фактически начисленное. */
  bonus: number;
  /** Весь остаток баллов: бывают начислены и другим путём, из админки. */
  pointsBalance: number;
  /** Сколько баллов даёт один друг — из настроек акции. */
  pointsPerInvite: number;
  /** Сколько приглашений оплачивается; ноль — без предела. */
  maxPaidInvites: number;
  /** Текст условий из админки. Правится там — меняется здесь. */
  terms: string;
  enabled: boolean;
}

interface ApiReferral {
  code?: string;
  invited?: Array<{
    user?: {
      uuid?: string;
      display_name?: string | null;
      slug?: string | null;
      avatar?: string | null;
    };
    joined_at?: string;
    status?: string;
    points?: number;
    listing_credits?: number;
    subscription_days?: number;
  }>;
  invited_count?: number;
  clicks?: number;
  verified?: number;
  bonus?: number;
  points_balance?: number;
  points_per_invite?: number;
  max_paid_invites?: number;
  terms?: string;
  enabled?: boolean;
}

export function referralLinkFor(code: string): string {
  const origin = publicOrigin();
  return code ? `${origin}/r/${encodeURIComponent(code)}` : origin;
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
        displayName: i.user?.display_name ?? "Друг",
        slug: i.user?.slug ?? null,
        avatar: i.user?.avatar ?? null,
      },
      joinedAt: i.joined_at ?? "",
      status: i.status === "completed" ? "completed" : "pending",
      points: i.points ?? 0,
      listingCredits: i.listing_credits ?? 0,
      subscriptionDays: i.subscription_days ?? 0,
    })),
    invitedCount: d.invited_count ?? 0,
    clicks: d.clicks ?? 0,
    verified: d.verified ?? 0,
    bonus: d.bonus ?? 0,
    pointsBalance: d.points_balance ?? 0,
    pointsPerInvite: d.points_per_invite ?? 0,
    maxPaidInvites: d.max_paid_invites ?? 0,
    terms: d.terms ?? "",
    enabled: d.enabled ?? true,
  };
}

export async function trackReferralClick(code: string): Promise<void> {
  const trimmed = code.trim();
  if (trimmed.length < 4) return;
  try {
    await api("/public/referrals/click", { method: "POST", json: { code: trimmed }, auth: false });
  } catch {
    /* analytics — ignore */
  }
}

export async function claimReferralCode(code: string): Promise<boolean> {
  const trimmed = code.trim();
  if (!trimmed) return false;
  try {
    const res = await api<{ data?: { claimed?: boolean } }>("/users/me/referrals/claim", {
      method: "POST",
      json: { code: trimmed },
    });
    return Boolean(res.data?.claimed);
  } catch {
    return false;
  }
}

const listeners = new Set<() => void>();

/** Drop cached referral stats so «Доступно» and invite counts refetch. */
export function invalidateReferral(): void {
  listeners.forEach((fn) => fn());
}

export function useReferral(): { data: ReferralData | null; loading: boolean } {
  const [data, setData] = useState<ReferralData | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onInvalidate = () => setTick((n) => n + 1);
    listeners.add(onInvalidate);
    const onFocus = () => {
      if (document.visibilityState === "visible") onInvalidate();
    };
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onFocus);
    return () => {
      listeners.delete(onInvalidate);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onFocus);
    };
  }, []);

  useEffect(() => {
    if (!getToken() && !isDemoMode()) {
      setLoading(false);
      return;
    }
    let active = true;
    fetchReferral()
      .then((d) => active && setData(d))
      .catch((e) => reportReadFailure(e, "реферальная программа"))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [tick]);
  return { data, loading };
}
