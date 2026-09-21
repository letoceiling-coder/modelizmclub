/**
 * Можно ли отказаться от сделки и как это назвать.
 *
 * Страница сделки считала это сама, списком состояний `paid` и `shipped`, и
 * расходилась с сервером: политика разрешает отмену ещё и на `created`. Из-за
 * расхождения у неоплаченной сделки блок действий не рисовался вовсе, и
 * покупатель, ушедший с формы банка, не имел чем отказаться — до получаса,
 * пока сделку не погасит сторож (приёмка 20.09).
 *
 * Право спрашиваем у сервера. Запасной список нужен старым ответам без `can`
 * и повторяет политику, а не прежнее поведение страницы.
 */
export type DealCancel =
  /** Кнопки нет. */
  | { allowed: false }
  /** Деньги списаны — отмена означает возврат. */
  | { allowed: true; kind: "refund" }
  /** Оплаты не было — отмена означает просто отказ. */
  | { allowed: true; kind: "abandon" };

const ОТМЕНЯЕМЫЕ = ["created", "paid", "shipped"];

export function dealCancel(deal: { status: string; can?: { cancel?: boolean } }): DealCancel {
  const allowed = deal.can?.cancel ?? ОТМЕНЯЕМЫЕ.includes(deal.status);
  if (!allowed) return { allowed: false };
  return { allowed: true, kind: deal.status === "created" ? "abandon" : "refund" };
}
