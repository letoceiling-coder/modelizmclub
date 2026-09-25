import { getPublicBootstrapSync } from "@/lib/api/bootstrap";

/**
 * Ключ JavaScript API Яндекс.Карт.
 *
 * Отдельным модулем, а не константой рядом с загрузчиком. Причина
 * практическая: `import.meta.env` сборщик подставляет в каждый модуль своей
 * копией, подменить её из проверки нельзя (пробовал 22.09), и загрузчик
 * остался бы без проверок вовсе — а именно в нём живут «один тег на
 * вкладку» и «отказ не запирает карту навсегда».
 *
 * Сначала спрашиваем настройку, приходящую с `/public/bootstrap`: её
 * меняют в админке, и карта включается со следующей загрузки страницы, без
 * выкатки. `import.meta.env` остаётся запасным путём — для сборок, где
 * ключ уже вшит.
 */
export function yandexMapsKey(): string {
  const изНастроек = String(
    getPublicBootstrapSync()?.integration_keys?.yandex_maps_key ?? "",
  ).trim();
  if (изНастроек !== "") return изНастроек;

  return String(
    (import.meta as { env?: Record<string, string | undefined> }).env?.VITE_YANDEX_MAPS_KEY ?? "",
  ).trim();
}
