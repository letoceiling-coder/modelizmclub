import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsDesktopRail } from "@/components/settings/SettingsDesktopRail";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: i18n.t("pages.settings.metaTitle") }] }),
  component: SettingsLayout,
});

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const atIndex = pathname === "/settings";
  return (
    <AppLayout sidebar={<SettingsDesktopRail activePath={pathname} />}>
      <div className="w-full">
        {/*
          Заголовок первого уровня — только на самой странице настроек.

          Стоит здесь, а не в списке разделов ниже: тот список рисуется
          `block lg:hidden`, то есть на широком экране его нет вовсе, и
          заголовок вместе с ним пропадал. Замер на стенде 05.10 нашёл
          /settings без `<h1>` на 1280 px и с ним — на 360.

          Через общую таблицу в `lib/layout/page-titles.ts` не поставить:
          адрес оболочка берёт у совпадения маршрута, а у дочерних страниц
          настроек оно равно родительскому `/settings`, и у /settings/wallet
          выходило два заголовка. Здесь `atIndex` — настоящий адрес, и
          удвоиться не может.

          На экране не меняется ничего: `sr-only` убирает узел с глаз.
        */}
        {atIndex ? <h1 className="sr-only">{i18n.t("nav.settings")}</h1> : null}
        {/* Section rail: mobile only, and only at the index — desktop uses
            the takeover rail in AppLayout's sidebar slot instead. */}
        <div className={atIndex ? "block lg:hidden" : "hidden"}>
          <SettingsNav activePath={pathname} />
        </div>
        {/* Content: desktop always; mobile only when a child is active */}
        <div className={atIndex ? "hidden lg:block" : "block"}>
          <Outlet />
        </div>
      </div>
    </AppLayout>
  );
}
