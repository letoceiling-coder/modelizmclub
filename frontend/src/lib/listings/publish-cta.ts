/**
 * Что написано на главной кнопке формы объявления.
 *
 * Решение вынесено из маршрута, потому что у него четыре входа и семь
 * исходов, а ошибка в нём стоит дорого: 20.09 кнопка в правке черновика
 * безусловно говорила «Сохранить изменения», и объявление в платной
 * категории не публиковалось вовсе — ни из списка, где сервер отвечал
 * «нужна оплата», ни из формы, которая к оплате не вела.
 *
 * Функция возвращает ключ перевода, а не готовую строку: так её можно
 * проверять, не поднимая i18n.
 */
export type PublishCta =
  | { key: "saveChanges" }
  | { key: "calculating" }
  | { key: "publish" }
  | { key: "publishFree" }
  | { key: "payAndPublish"; priceCents: number };

export function publishCta(opts: {
  /** Правим существующее объявление. */
  editing: boolean;
  /** Правим именно черновик — его ещё предстоит опубликовать. */
  editingDraft: boolean;
  paymentEnabled: boolean;
  flagsHydrated: boolean;
  quoteLoading: boolean;
  quote: { is_free: boolean; final_cents: number } | null;
}): PublishCta {
  const { editing, editingDraft, paymentEnabled, flagsHydrated, quoteLoading, quote } = opts;

  // Опубликованное объявление правят, а не публикуют: денег это не стоит.
  if (editing && !editingDraft) return { key: "saveChanges" };

  // Пока не знаем, включена ли оплата, про деньги не утверждаем ничего:
  // значение флага по умолчанию — «выключена», и до гидрации кнопка обещала
  // бы бесплатную публикацию.
  if (!flagsHydrated) return { key: "calculating" };
  if (!paymentEnabled) return { key: "publish" };
  if (quoteLoading) return { key: "calculating" };
  if (!quote) return { key: "publish" };
  if (quote.is_free) return { key: "publishFree" };
  return { key: "payAndPublish", priceCents: quote.final_cents };
}
