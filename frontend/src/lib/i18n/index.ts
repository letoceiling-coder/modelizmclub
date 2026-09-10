import i18n from "i18next";
import { initReactI18next } from "react-i18next";

import { ru } from "./locales/ru";

/**
 * Интерфейс на одном языке — русском.
 *
 * Английский и китайский словари были в репозитории, но недостижимы: провайдер
 * при каждом запуске выставлял русский и стирал сохранённый выбор языка,
 * переключателя в интерфейсе не было. Пока они лежали мёртвым грузом, в них
 * накопилось 489 непереведённых строк на английский и 496 на китайский —
 * русский текст под видом перевода. Открой их кто-нибудь, он увидел бы
 * наполовину русский экран.
 *
 * Поэтому оставлен один язык, а не починен переключатель: доперевести тысячу
 * строк — работа переводчика, и делать её до того, как язык кому-то
 * понадобится, значит поддерживать словарь, который никто не читает.
 * Вернуться к этому можно, когда появится спрос: `t()` и ключи никуда не
 * делись, добавить локаль — значит вернуть файл словаря и загрузчик.
 */
export const LOCALE = "ru";

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    // Одно пространство имён с вложенным словарём: вызовы идут точечными
    // путями — t("nav.feed"), t("common.save").
    resources: {
      ru: { translation: ru },
    },
    lng: LOCALE,
    fallbackLng: LOCALE,
    defaultNS: "translation",
    interpolation: { escapeValue: false },
    react: { useSuspense: false },
    // Заглушает рекламное сообщение Locize в консоли продакшена.
    showSupportNotice: false,
  });
}

/**
 * Досылает словарь админки.
 *
 * Тридцать три её раздела весят 66 КБ и лежали в общем словаре — то есть в
 * главном чанке у каждого посетителя, включая тех, кто админку не откроет
 * никогда. Ключи не менялись (`pages.adminUsers.…`), кусок домешивается в тот
 * же словарь глубоким слиянием, поэтому места вызова остались прежними.
 *
 * Зовётся из `beforeLoad` маршрута /admin — до того, как что-то отрисуется,
 * иначе первый кадр показал бы точечные пути вместо подписей.
 */
let adminBundle: Promise<void> | null = null;

export function loadAdminLocale(): Promise<void> {
  const existing = i18n.getResourceBundle(LOCALE, "translation") as
    | { pages?: Record<string, unknown> }
    | undefined;
  if (existing?.pages?.adminShell) return Promise.resolve();

  if (adminBundle) return adminBundle;

  adminBundle = import("./locales/ru-admin").then((m) => {
    // deep = true, overwrite = false: досылаем недостающее, не затирая уже
    // загруженный словарь.
    i18n.addResourceBundle(LOCALE, "translation", m.ruAdmin, true, false);
  });

  return adminBundle;
}

export default i18n;
