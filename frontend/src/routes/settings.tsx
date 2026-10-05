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
        {/* Section rail: mobile only, and only at the index — desktop uses
            the takeover rail in AppLayout's sidebar slot instead. */}
        <div className={atIndex ? "block lg:hidden" : "hidden"}>
          {/*
            Заголовок первого уровня — только на самой странице настроек.

            Замер 04.10 нашёл /settings без `<h1>`. Через общую таблицу в
            `lib/layout/page-titles.ts` его не поставить: адрес оболочка
            берёт у своего совпадения маршрута, а у дочерних страниц оно
            равно родительскому `/settings` — правило срабатывало и на
            /settings/wallet, где заголовок уже есть, и выходило два.

            Здесь ветка отрисовывается только при `atIndex`, то есть ровно на
            /settings, и удвоиться не может. На экране не меняется ничего:
            список разделов и есть заголовок страницы, просто нарисованный
            не словом.
          */}
          {atIndex ? <h1 className="sr-only">{i18n.t("nav.settings")}</h1> : null}
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
