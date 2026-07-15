// Subscription state — real API in production, honest demo constants on demo
// hosts. Shared by the sidebar status line and /subscription.
import { useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demo-mode";
import { fetchMySubscription, type MySubscription } from "@/lib/api/payment";
import { isAuthenticated } from "@/lib/auth/session";

/** Demo-only constants (neeklo stand / local dev — no billing backend). */
const DEMO_DAYS_LEFT = 287;

function demoSubscription(): MySubscription {
  return {
    id: 0,
    status: "active",
    starts_at: null,
    ends_at: new Date(Date.now() + DEMO_DAYS_LEFT * 86400000).toISOString(),
    auto_renew: false,
    is_active: true,
    days_left: DEMO_DAYS_LEFT,
    plan: {
      id: 0,
      slug: "year",
      name: "Год",
      description: null,
      price_cents: 79900,
      price_rub: 799,
      period_days: 365,
      features: [],
      badge_label: null,
      sort_order: 0,
    },
  };
}

let cache: MySubscription | null | undefined;
let inflight: Promise<MySubscription | null> | null = null;

/** Current subscription (module-level cache, one request per SPA session). */
export async function getMySubscription(force = false): Promise<MySubscription | null> {
  if (isDemoMode()) return demoSubscription();
  if (!isAuthenticated()) return null;
  if (!force && cache !== undefined) return cache;
  if (!inflight || force) {
    inflight = fetchMySubscription()
      .then((sub) => {
        cache = sub;
        return sub;
      })
      .catch(() => {
        inflight = null; // let the next call retry after a transient failure
        return null;
      });
  }
  return inflight;
}

/** Drop the cached subscription (after a successful payment). */
export function invalidateMySubscription(): void {
  cache = undefined;
  inflight = null;
}

/** React hook over getMySubscription(). `sub` is null when on the free tier. */
export function useMySubscription(): { sub: MySubscription | null; loading: boolean } {
  const [sub, setSub] = useState<MySubscription | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getMySubscription()
      .then((s) => {
        if (alive) setSub(s);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  return { sub, loading };
}

export function formatSubscriptionEndDate(sub: MySubscription | null): string {
  if (!sub?.ends_at) return "";
  return new Date(sub.ends_at).toLocaleDateString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
