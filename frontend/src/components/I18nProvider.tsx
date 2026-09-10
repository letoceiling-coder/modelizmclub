import type { ReactNode } from "react";
import { I18nextProvider } from "react-i18next";

import i18n from "@/lib/i18n";

/**
 * Подключает i18next к дереву React. Больше он ничего не делает.
 *
 * Раньше здесь при каждом запуске выставлялся русский и стирался ключ
 * `mc_lang` — обход того, что словари английского и китайского существовали,
 * но были недопереведены. Языков теперь один, обходить нечего: `lng` задан
 * при инициализации, `<html lang="ru">` стоит в разметке статически.
 *
 * Вместе с переключением ушло и затухание содержимого на `languageChanged`:
 * событие, которому больше нечем сработать, а обёртка вокруг `<Outlet>` ради
 * него оставалась в каждом кадре.
 */
export function I18nProvider({ children }: { children: ReactNode }) {
  return <I18nextProvider i18n={i18n}>{children}</I18nextProvider>;
}
