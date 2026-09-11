import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { DirectionsRightRail } from "./DirectionsRightRail";
import { BottomNav } from "./BottomNav";
import { MobileHeader } from "./MobileHeader";
import { DesktopTopBar } from "./DesktopTopBar";
import { AppFooter } from "./AppFooter";

interface Props {
  children: ReactNode;
  rightColumn?: ReactNode | false;
  navCollapsed?: boolean;
  footer?: boolean;
  /** Replaces the default app <Sidebar> — e.g. a takeover nav for a
   *  sub-section (Настройки) so two left-column navs never show at once.
   *  Omit for the default Sidebar; pass `false` to render no left column. */
  sidebar?: ReactNode | false;
  /** Suppresses the mobile app-chrome header (logo/search/favorites/bell/
   *  burger) — for sections with their own full-width contextual header
   *  (e.g. messenger, Avito-style). Desktop's DesktopTopBar is unaffected. */
  hideMobileHeader?: boolean;
  /** Hides the mobile BottomNav — for full-screen immersive views (e.g. an
   *  open chat, Avito-style) where the section owns the whole viewport and
   *  exits via its own back arrow. Desktop is unaffected (nav is md:hidden). */
  hideBottomNav?: boolean;
  /** Держит **содержимое** центральной колонки в 680 px — ширина строки, за
   *  которой текст перестаёт читаться. Саму колонку не сужает: до 10.09
   *  сужал, и от этого центр прыгал между разделами (замер ниже). Теперь
   *  колонка одна на все маршруты, а узкие разделы центруют внутри неё. */
  narrowCenter?: boolean;
}

export function AppLayout({
  children,
  rightColumn,
  navCollapsed,
  footer,
  sidebar,
  hideMobileHeader,
  hideBottomNav,
  narrowCenter,
}: Props) {
  return (
    // 100dvh keeps the shell stable on mobile Safari/Chrome (no 100vh jump).
    // overflow-x-clip is a belt-and-braces guard against horizontal scroll.
    // Desktop: shell is a flex column clamped to 100dvh with overflow hidden.
    // Only <main> scrolls — sidebar and right rail are fixed-height columns.
    // Mobile: normal document scroll (min-h, no overflow-hidden, no flex-col).
    <div className="min-h-[100dvh] overflow-x-clip bg-background lg:flex lg:h-[100dvh] lg:flex-col lg:overflow-hidden">
      {hideMobileHeader ? (
        <div className="lg:hidden" style={{ height: "var(--safe-top)" }} />
      ) : (
        <MobileHeader />
      )}
      <DesktopTopBar />
      {/*
        Mobile: pt-4/pb/px-3 — normal flow with BottomNav clearance.
        Desktop: flex-1 fills remaining shell height; items-stretch makes all
        three columns (sidebar, main, right rail) full-height so each can
        manage its own overflow independently. pt-4 is kept on both breakpoints
        so the top spacing is unchanged from the previous design.
      */}
      {/*
        Три колонки заданы дорожками сетки, а не содержимым.

        До 10.09 каждый маршрут выбирал себе геометрию пропсами, и центр
        ездил между разделами. Замерено на 1440 переходами по меню:

          /feed → /messenger   центр  680 → 1135,2 px, левый край −35,2
          /friends → /ads      центр  680 → 1311,2 px, левый край −211,2
          /deals → /favorites  центр 1135,2 → 750,41 px

        Причина не в полосе прокрутки: её нет ни на одном маршруте —
        оболочка ограничена 100dvh, прокручивается только <main>.
        `scrollbar-gutter` тут не лечит ничего.

        Теперь ширины дорожек постоянны: пропала правая колонка — её место
        остаётся занятым, а не раздаёт ширину центру.
      */}
      <div
        className={cn(
          "mx-auto flex w-full max-w-[var(--container-max)] items-start gap-6 px-3 pt-4",
          hideBottomNav ? "pb-[var(--safe-bottom)]" : "pb-[calc(var(--bottom-nav-space)+8px)]",
          // Нижняя панель исчезает с 768 — с неё же снимается и отступ под неё.
          "md:pb-4",
          "lg:flex-1 lg:items-stretch lg:overflow-hidden lg:px-[var(--container-pad)] lg:pb-0",
          "xl:grid xl:grid-cols-[var(--sidebar-w)_minmax(0,1fr)_var(--rightrail-w)]",
        )}
      >
        {sidebar === false ? null : (sidebar ?? <Sidebar collapsed={navCollapsed} />)}
        {/* Center column: the only scroll zone on desktop. */}
        <main className="min-w-0 flex-1 lg:overflow-y-auto xl:flex-none">
          {/*
            Подвал не заходит в первый экран, пока грузится содержимое.

            Страница рисуется раньше своих данных: скелетон или пустое место,
            под ними — подвал. Потом приходят данные, высота содержимого
            меняется, и подвал едет — вверх, если карточек меньше, чем
            заглушек, вниз, если больше. Этот сдвиг и был CLS переходов,
            замер 11.09 на проде:

              /friends → /favorites  375   0,112  подвал Δy −142
              /deals → /my-ads       1440  0,073  подвал Δy +630
              /ads после фильтра     375   0,088  подвал Δy +701

            Подогнать заглушку под ответ нельзя — число карточек заранее
            неизвестно. Поэтому содержимое держит высоту не меньше экрана:
            подвал начинается ниже сгиба, а сдвиги за пределами видимого
            в CLS не считаются. На desktop прокручивается <main> ниже шапки,
            на телефоне — документ ниже мобильной шапки; в обоих случаях
            100dvh — с запасом. Цена: на короткой странице подвал виден
            после прокрутки. Только там, где подвал есть: полноэкранным
            разделам (мессенджер) лишняя обёртка ни к чему.
          */}
          {footer ? (
            <div className="min-h-[100dvh]">
              {narrowCenter ? (
                <div className="mx-auto w-full max-w-[680px]">{children}</div>
              ) : (
                children
              )}
            </div>
          ) : narrowCenter ? (
            <div className="mx-auto w-full max-w-[680px]">{children}</div>
          ) : (
            children
          )}
          {footer && <AppFooter />}
        </main>
        {rightColumn === false ? (
          // Пустая дорожка вместо колонки: место занято, центр не разъезжается.
          <div className="hidden xl:block" aria-hidden />
        ) : (
          (rightColumn ?? <DirectionsRightRail />)
        )}
      </div>
      {hideBottomNav ? null : <BottomNav />}
    </div>
  );
}
