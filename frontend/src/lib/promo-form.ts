/**
 * Что не так с формой промокода — одним ответом, до отправки.
 *
 * Проверки жили цепочкой `if … return toast.error(…)` внутри компонента,
 * то есть проверить их можно было только глазами. Вынесены сюда вместе с
 * появлением правки: правка добавила правило, которого у создания нет, —
 * предел применений не может быть ниже числа уже применённых.
 *
 * Возвращается ключ словаря и, если нужно, подстановка к нему: решение
 * «что не так» отделено от «как это написать».
 */
export interface PromoFormValues {
  code: string;
  type: "percent" | "fixed" | "free";
  discount: number;
  limit: number;
  startsAt: string;
  expiresAt: string;
}

export interface PromoFormProblem {
  key: string;
  count?: number;
}

export function promoFormProblem(opts: {
  form: PromoFormValues;
  audience: "all" | "selected";
  audienceCount: number;
  /** Число уже применённых — только при правке; при создании null. */
  usedCount: number | null;
}): PromoFormProblem | null {
  const { form, audience, audienceCount, usedCount } = opts;

  if (!form.code.trim()) return { key: "errCode" };
  if (!form.expiresAt) return { key: "errExpires" };
  if (form.type === "percent" && (form.discount < 1 || form.discount > 100)) {
    return { key: "errDiscount" };
  }
  if (form.limit < 1) return { key: "errLimit" };
  /*
   * Предел ниже числа применений оставил бы акцию «выбранной сверх
   * предела»: `seatsLeft` ушёл бы в минус. Сервер это пропускает,
   * поэтому не пускаем здесь и говорим, сколько уже применено.
   *
   * Правило есть только у правки: у новой акции применений ноль.
   */
  if (usedCount !== null && form.limit < usedCount) {
    return { key: "errLimitBelowUsed", count: usedCount };
  }
  // Строго больше: акция на один день — обычное дело.
  if (form.startsAt && form.startsAt > form.expiresAt) return { key: "errOrder" };
  if (audience === "selected" && audienceCount === 0) return { key: "errAudienceEmpty" };

  return null;
}
