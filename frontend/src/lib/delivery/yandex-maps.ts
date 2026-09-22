/**
 * Загрузчик карт Яндекса.
 *
 * Скрипт подключается один раз на вкладку и только тогда, когда карта
 * понадобилась, — то есть когда покупатель дошёл до выбора пункта выдачи.
 * Не в разметке и не при загрузке приложения: карта весит сотни килобайт и
 * нужна одному экрану из сорока.
 *
 * Без ключа модуль ничего не делает, и это штатно: карта — не единственный
 * способ выбрать пункт, рядом список с поиском по адресу. Ключ приезжает
 * сборкой, как номер счётчика Метрики.
 */

import { yandexMapsKey } from "@/lib/delivery/maps-key";

interface YMapsWindow extends Window {
  ymaps?: {
    ready: (cb: () => void) => void;
    Map: new (el: HTMLElement, state: unknown, options?: unknown) => YMap;
    ObjectManager: new (options?: unknown) => YObjectManager;
  };
}

/** Ровно та часть API 2.1, которой пользуется карта пунктов. */
export interface YMap {
  geoObjects: { add: (o: unknown) => void };
  setBounds: (bounds: number[][], options?: unknown) => Promise<void>;
  /**
   * Контейнер карты. Нужен ровно ради `fitToViewport`: карта, построенная в
   * скрытом узле, имеет нулевой размер и остаётся серым прямоугольником, пока
   * ей об этом не скажут.
   */
  container: { fitToViewport: () => void };
  destroy: () => void;
}

export interface YObjectManager {
  add: (data: unknown) => void;
  removeAll: () => void;
  objects: {
    events: { add: (name: string, cb: (e: { get: (k: string) => unknown }) => void) => void };
    options: { set: (options: Record<string, unknown>) => void };
    setObjectOptions: (id: string, options: Record<string, unknown>) => void;
  };
  clusters: { options: { set: (options: Record<string, unknown>) => void } };
}

export function isYandexMapsConfigured(): boolean {
  return yandexMapsKey() !== "";
}

let загрузка: Promise<YMapsWindow["ymaps"]> | null = null;

/**
 * Подключить API и дождаться готовности.
 *
 * Обещание одно на вкладку: два открытия мастера подряд не должны вставлять
 * второй тег — API 2.1 на повторное подключение отвечает ошибкой, а не
 * молча.
 */
export function loadYandexMaps(): Promise<YMapsWindow["ymaps"]> {
  if (загрузка) return загрузка;

  if (!isYandexMapsConfigured() || typeof window === "undefined") {
    return Promise.reject(new Error("Карты Яндекса не настроены: нет ключа"));
  }

  загрузка = new Promise((resolve, reject) => {
    const w = window as YMapsWindow;
    if (w.ymaps) {
      w.ymaps.ready(() => resolve(w.ymaps));

      return;
    }

    const s = document.createElement("script");
    s.src = `https://api-maps.yandex.ru/2.1/?apikey=${encodeURIComponent(yandexMapsKey())}&lang=ru_RU`;
    s.async = true;
    s.onload = () => {
      const ymaps = (window as YMapsWindow).ymaps;
      if (!ymaps) {
        /*
         * Сбрасывается и здесь, а не только в `onerror`. Скрипт, который
         * отдался, но не создал `ymaps` — так бывает на отозванном или
         * чужом ключе, — оставлял бы обещание отклонённым навсегда, и карта
         * не появилась бы до перезагрузки вкладки.
         */
        загрузка = null;
        reject(new Error("Карты Яндекса загрузились, но объект ymaps не появился"));

        return;
      }
      ymaps.ready(() => resolve(ymaps));
    };
    s.onerror = () => {
      /*
       * Обещание сбрасывается: отказ сети не должен запирать карту до
       * перезагрузки страницы. Следующее открытие попробует снова.
       */
      загрузка = null;
      reject(new Error("Не удалось загрузить карты Яндекса"));
    };
    document.head.appendChild(s);
  });

  return загрузка;
}
