import { useCallback, useEffect, useState } from "react";
import { fetchPublicPlans, type SubscriptionPlanApi } from "@/lib/api/payment";
import { mapApiPlansToPricingPlans, type PricingPlan } from "@/lib/config/pricing";
import { reportReadFailure } from "@/lib/errors/handle";

interface Результат {
  plans: PricingPlan[];
  loading: boolean;
  /** Запрос отказал — это не то же самое, что «тарифов нет». */
  failed: boolean;
  /** Повторить загрузку: для кнопки «Повторить» в состоянии отказа. */
  reload: () => void;
}

/**
 * Тарифы для лендинга и страницы подписки.
 *
 * Отказ здесь не стирается и не превращается в пустой список.
 *
 * Стояло `.catch(() => setPlans([]))`. Ворота `check-empty-catch.sh` такое
 * не ловят — тело обработчика не пустое, оно просто говорит неправду, — а
 * правило из CLAUDE.md нарушено ровно то же: человек видит ответ, которого
 * сервер не давал. «Тарифов нет» и «не удалось спросить» выглядели
 * одинаково.
 *
 * Замер 07.10 на боевой сборке, 1280×900, `/api/v1/plans` → 500, одним и
 * тем же селектором до и после:
 *
 * | Страница | API отвечает | Отказ: было | Отказ: стало |
 * | --- | --- | --- | --- |
 * | `/subscription` | 491 px, цены 99/0/99/99 ₽ | **0 px, детей 0, текста нет** | 261 px, «Повторить» |
 * | `/` | 785 px, те же цены | 346 px, `emptyFallback` «Подробнее» | 563 px, «Повторить» |
 *
 * На `/subscription` человек приходил именно за ценами и получал пустое
 * место. На лендинге подмена выглядела мягче, но говорила то же неверное:
 * «подписка есть, тарифы смотрите на другой странице» вместо «спросить не
 * удалось».
 *
 * Человек ничего не нажимал, страница грузила данные сама — значит по
 * таблице в CLAUDE.md `reportReadFailure` (без окна с ошибкой) и состояние
 * с «Повторить» в интерфейсе. Нажатие проверено: запросов к `/plans` стало
 * 2, и при живом API блок вернулся к 491 px с ценами.
 *
 * `emptyFallback` остаётся живым: он показывается, когда запрос прошёл, а
 * активных тарифов в админке нет, — и только тогда.
 */
export function usePricingPlans(): Результат {
  const [plans, setPlans] = useState<PricingPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [попытка, setПопытка] = useState(0);

  const reload = useCallback(() => setПопытка((n) => n + 1), []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setFailed(false);
    fetchPublicPlans()
      .then((apiPlans) => {
        if (!active) return;
        setPlans(mapApiPlansToPricingPlans(apiPlans));
      })
      .catch((err) => {
        reportReadFailure(err, "тарифы подписки");
        if (!active) return;
        setPlans([]);
        setFailed(true);
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [попытка]);

  return { plans, loading, failed, reload };
}

export type { PricingPlan, SubscriptionPlanApi };
