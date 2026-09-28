/**
 * Куда можно отправить ссылку: посты, объявления, сообщества, приглашения.
 *
 * ПОЧЕМУ У MAX НЕТ ССЫЛКИ, А У ОСТАЛЬНЫХ ЕСТЬ. У Telegram, VK и WhatsApp
 * есть веб-ручка «поделиться»: открыл адрес — открылось окно отправки с
 * подставленным текстом. У MAX такой ручки нет. Проверено вживую 28.09:
 *
 *   https://max.ru/share?url=…        404
 *   https://max.ru/share/url?url=…    404
 *   https://max.ru/sharing?url=…      404
 *   https://web.max.ru/share?url=…    200, но это экран входа веб-клиента:
 *                                     заведомо несуществующий путь
 *                                     отдаёт ровно тот же экран
 *   dev.max.ru/docs, /docs-api        про «поделиться» ничего нет
 *
 * Двухсотка у `web.max.ru` — как раз та проба, которая не умеет отвечать
 * «нет»: она одинакова для любого пути. Сделать по ней кнопку значило бы
 * вывести людей на экран входа вместо отправки.
 *
 * Настоящий путь в MAX с веб-страницы один — системное окно «Поделиться»
 * (`navigator.share`). На телефоне с установленным MAX он там есть рядом
 * с остальными приложениями, и ссылка с текстом уходит именно туда. На
 * рабочем столе такого окна нет, и тогда честнее скопировать ссылку и
 * сказать об этом словами, чем открывать страницу, которая не отправит.
 */

export type ShareTarget = {
  id: "telegram" | "whatsapp" | "vk" | "max";
  label: string;
  /**
   * Веб-ручка «поделиться». Пусто — её у мессенджера нет, и отправка идёт
   * системным окном (см. `shareViaSystem`).
   */
  href?: (url: string, title?: string) => string;
};

export const SHARE_TARGETS: ShareTarget[] = [
  {
    id: "telegram",
    label: "Telegram",
    href: (url, title) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}${title ? `&text=${encodeURIComponent(title)}` : ""}`,
  },
  {
    id: "max",
    label: "MAX",
  },
  {
    id: "whatsapp",
    label: "WhatsApp",
    href: (url, title) =>
      `https://wa.me/?text=${encodeURIComponent(title ? `${title} ${url}` : url)}`,
  },
  {
    id: "vk",
    label: "VK",
    href: (url, title) =>
      `https://vk.com/share.php?url=${encodeURIComponent(url)}${title ? `&title=${encodeURIComponent(title)}` : ""}`,
  },
];

export function openShareTarget(href: string): void {
  if (typeof window !== "undefined") window.open(href, "_blank", "noopener,noreferrer");
}

/** Что сделало системное окно: отправили, отменили, скопировали или отказ. */
export type SystemShareResult = "shared" | "cancelled" | "copied" | "failed";

/**
 * Отправка через системное окно «Поделиться» — единственный путь в MAX.
 *
 * Отказ `navigator.share` означает не «сломалось», а «человек закрыл
 * окно»: браузеры отвечают `AbortError` на отмену. Различаем, потому что
 * на отмену ругаться нельзя, а на настоящий отказ — нужно.
 */
export async function shareViaSystem(url: string, title?: string): Promise<SystemShareResult> {
  if (typeof navigator === "undefined") return "failed";

  const share = (navigator as Navigator & { share?: (d: ShareData) => Promise<void> }).share;

  if (share) {
    try {
      await share.call(navigator, { title, text: title, url });
      return "shared";
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
      // Не отмена, а отказ — например, страница не по https. Тогда ещё
      // не всё потеряно: остаётся буфер обмена.
    }
  }

  try {
    await navigator.clipboard?.writeText(title ? `${title} ${url}` : url);
    return "copied";
  } catch {
    return "failed";
  }
}
