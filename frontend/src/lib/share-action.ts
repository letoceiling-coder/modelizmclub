import { toast } from "@/lib/toast";
import {
  openShareTarget,
  shareViaSystem,
  type ShareTarget,
  type SystemShareResult,
} from "@/lib/share-targets";

/**
 * Нажатие на способ отправки — одно на все списки.
 *
 * Раньше каждый список собирал ссылки сам, и они разошлись: на странице
 * приглашений WhatsApp получал только ссылку без текста, а VK — без
 * подписи, хотя в общем списке и то и другое передавалось. Замечено это
 * было не на экране, а проверкой вживую: `wa.me/?text=<ссылка>` открывает
 * окно отправки, где текста приглашения нет вовсе.
 *
 * Поэтому нажатие живёт здесь: один способ построить адрес, один ответ на
 * отказ.
 */
export async function runShareTarget(
  target: ShareTarget,
  url: string,
  title?: string,
): Promise<void> {
  if (target.href) {
    openShareTarget(target.href(url, title));
    return;
  }

  сказать(await shareViaSystem(url, title), target.label);
}

/** Отправка системным окном без конкретного адресата — кнопка «Поделиться». */
export async function runSystemShare(url: string, title?: string): Promise<void> {
  сказать(await shareViaSystem(url, title));
}

function сказать(итог: SystemShareResult, куда?: string): void {
  if (итог === "shared" || итог === "cancelled") {
    // Отмену человек сделал сам — говорить ему об этом незачем.
    return;
  }

  if (итог === "copied") {
    /*
     * Не молчим и не врём «отправлено». Системного окна нет — значит это
     * рабочий стол, и единственное, что мы правда сделали, — положили
     * ссылку в буфер. Человеку нужно сказать, что делать дальше.
     */
    toast.success(
      куда
        ? `Ссылка скопирована — вставьте её в ${куда}`
        : "Ссылка скопирована — вставьте её в мессенджер",
    );
    return;
  }

  toast.error("Не удалось поделиться. Скопируйте ссылку вручную.");
}
