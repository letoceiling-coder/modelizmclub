import type { ReactNode } from "react";
import { useMatch } from "@tanstack/react-router";
import { cn } from "@/lib/utils";
import { hasDirectionsRail } from "@/lib/layout/rails";
import { Sidebar } from "./Sidebar";
import { DirectionsRightRail } from "./DirectionsRightRail";
import { BottomNav } from "./BottomNav";
import { MobileHeader } from "./MobileHeader";
import { DesktopTopBar } from "./DesktopTopBar";
import { AppFooter } from "./AppFooter";

interface Props {
  children: ReactNode;
  /**
   * Есть ли правая панель. По умолчанию — по правилу маршрута
   * (`lib/layout/rails.ts`): так страница, её скелетон, ожидание маршрута и
   * экран ошибки получают одну раскладку. Явно передают только те, кому
   * правило не подходит.
   */
  rail?: boolean;
  /** Содержимое правой панели, когда она есть. По умолчанию — панель направлений. */
  rightColumn?: ReactNode;
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
}

export function AppLayout({
  children,
  rail,
  rightColumn,
  navCollapsed,
  footer,
  sidebar,
  hideMobileHeader,
  hideBottomNav,
}: Props) {
  /*
    Адрес берём у своего совпадения, а не у роутера. location роутера
    меняется в момент клика, а старая страница остаётся на экране, пока
    грузится новая: с адресом роутера она успевала перестроиться под чужую
    раскладку — центр ездил на 30–35 px (CLS 0,015–0,043 на всех парах,
    замер 11.09). Своё совпадение у страницы не меняется до размонтирования.
  */
  const pathname = useMatch({ strict: false, select: (m) => m.pathname });
  const withRail = rail ?? hasDirectionsRail(pathname);

  /*
    С панелью центр держит строку в 680 — ширина, за которой лента перестаёт
    читаться, как у ВКонтакте. Без панели ограничения нет: каталог, мессенджер,
    объявление занимают всё место до правого края, как у Авито.
  */
  const content = withRail ? (
    <div className="mx-auto w-full max-w-[680px]">{children}</div>
  ) : (
    children
  );

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
        columns (sidebar, main, right rail) full-height so each can manage its
        own overflow independently.
      */}
      {/*
        Две раскладки, одна геометрия слева.

        С панелью — дорожки 240 / центр / 320. Без панели — 240 / центр, и
        центр забирает всё до правого края. До 11.09 на месте отсутствующей
        панели стояла пустая дорожка в 320: так 10.09 уняли прыжки центра
        между разделами, но на каталоге, мессенджере, объявлении и ещё
        четырнадцати страницах справа зияла пустота.

        Прыжков это не возвращает. Тогда ездил левый край центра — центр
        сужали и центровали. Сейчас контейнер, поля и левая колонка одинаковы
        в обеих раскладках, левый край центра стоит на месте, меняется только
        его ширина и наличие панели. Сдвиг раскладки считается по смещению
        начала элемента, а новая страница и появившаяся панель — это вставка,
        не сдвиг. Замер всех пар переходов — в описании ветки.
      */}
      <div
        className={cn(
          "mx-auto flex w-full max-w-[var(--container-max)] items-start gap-6 px-3 pt-4",
          hideBottomNav ? "pb-[var(--safe-bottom)]" : "pb-[calc(var(--bottom-nav-space)+8px)]",
          // Нижняя панель исчезает с 768 — с неё же снимается и отступ под неё.
          "md:pb-4",
          "lg:flex-1 lg:items-stretch lg:overflow-hidden lg:px-[var(--container-pad)] lg:pb-0",
          withRail
            ? "xl:grid xl:grid-cols-[var(--sidebar-w)_minmax(0,1fr)_var(--rightrail-w)]"
            : "xl:grid xl:grid-cols-[var(--sidebar-w)_minmax(0,1fr)]",
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
          {footer ? <div className="min-h-[100dvh]">{content}</div> : content}
          {footer && <AppFooter />}
        </main>
        {withRail ? (rightColumn ?? <DirectionsRightRail />) : null}
      </div>
      {hideBottomNav ? null : <BottomNav />}
    </div>
  );
}
