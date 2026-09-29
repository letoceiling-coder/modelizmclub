import { useEffect, useState } from "react";
import { api, ApiError } from "./client";
import { reportReadFailure } from "@/lib/errors/handle";

/** Одна проводка по счёту баллов. Минус — списание. */
export interface BonusPointsEntry {
  id: number;
  amount: number;
  type: string;
  description: string;
  created_at: string | null;
}

export interface BonusBoostPrice {
  id: string;
  label: string;
  days: number;
  price_cents: number;
  /** Ноль — этот пакет баллами не оплачивается, только деньгами. */
  points: number;
}

export interface BonusPointsData {
  balance: number;
  earned_by_referrals: number;
  enabled: boolean;
  /** Ноль — размещение баллами не оплачивается. */
  listing_placement_points: number;
  boosts: BonusBoostPrice[];
  history: BonusPointsEntry[];
}

export const BONUS_POINTS_EMPTY: BonusPointsData = {
  balance: 0,
  earned_by_referrals: 0,
  enabled: false,
  listing_placement_points: 0,
  boosts: [],
  history: [],
};

export async function fetchBonusPoints(): Promise<BonusPointsData> {
  const res = await api<{ data: Partial<BonusPointsData> }>("/bonus-points");
  const d = res.data ?? {};
  return {
    ...BONUS_POINTS_EMPTY,
    ...d,
    boosts: d.boosts ?? [],
    history: d.history ?? [],
  };
}

/**
 * Счёт баллов для страницы.
 *
 * Данные приезжают после монтирования: остаток зависит от вошедшего, а
 * первый кадр на сервере и в браузере обязан совпадать.
 */
export function useBonusPoints(enabled = true) {
  const [data, setData] = useState<BonusPointsData | null>(null);
  const [loading, setLoading] = useState(enabled);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    fetchBonusPoints()
      .then((d) => {
        if (active) setData(d);
      })
      .catch((e) => reportReadFailure(e, "бонусные баллы"))
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [enabled]);

  return { data, loading };
}

/**
 * Отказ «не хватает баллов» — и сколько именно не хватает.
 *
 * Отдельно от `isInsufficientFunds`: там рубли и совет пополнить кошелёк.
 * Баллы деньгами не пополняются, и такой совет был бы обещанием того,
 * чего нет. Сообщение берём серверное — число в нём уже посчитано там,
 * где известен остаток.
 */
export function insufficientPoints(
  error: unknown,
): { message: string; shortBy: number; balance: number } | null {
  if (!(error instanceof ApiError) || error.status !== 422) return null;

  const payload = error.payload as
    | { code?: string; message?: string; points_short_by?: number; points_balance?: number }
    | undefined;

  if (payload?.code !== "insufficient_points") return null;

  return {
    message: payload.message ?? error.message,
    shortBy: payload.points_short_by ?? 0,
    balance: payload.points_balance ?? 0,
  };
}
