import { api } from "@/lib/api/client";
import { ignoreFailure } from "@/lib/errors/handle";

/**
 * Уход на форму банка — одной дорогой из всех семи мест.
 *
 * ЗАЧЕМ ПОМОЩНИК. В воронке есть шаг «дошло до формы», и взять его
 * неоткуда: создание заказа и переход на форму — разные события, между
 * ними человек может закрыть вкладку. Мест, где мы уходим на оплату,
 * семь; отметить в шести из них значит получить шаг, который врёт на
 * седьмую долю и молчит об этом.
 *
 * ОТМЕТКА НЕ ЗАДЕРЖИВАЕТ ОПЛАТУ. Если запрос не прошёл, человек всё равно
 * уходит платить: статистика не повод мешать покупке. Поэтому отказ
 * проглатывается осознанно и с причиной — пустой `catch` в проекте
 * запрещён.
 */
export async function goToCheckout(checkout: {
  payment_uuid?: string | null;
  /** null бывает у оплаты с баланса и баллами — там уходить некуда. */
  checkout_url?: string | null;
}): Promise<void> {
  if (!checkout.checkout_url) {
    return;
  }

  if (checkout.payment_uuid) {
    await api(`/payments/${checkout.payment_uuid}/form-opened`, { method: "POST" }).catch(
      ignoreFailure("отметка «дошёл до формы» — статистика не должна мешать оплате"),
    );
  }

  window.location.href = checkout.checkout_url;
}
