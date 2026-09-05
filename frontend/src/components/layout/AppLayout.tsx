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
  /** Держит центральную колонку в 680 px на широком экране — ширина строки,
   *  за которой текст перестаёт читаться, и ровно та, на которой построена
   *  лента. Остальные разделы (каталог, админка, мессенджер) занимают всё
   *  доступное место, как занимали. */
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
      <div
        className={cn(
          "mx-auto flex w-full max-w-[var(--container-max)] items-start gap-6 px-3 pt-4",
          hideBottomNav ? "pb-[var(--safe-bottom)]" : "pb-[calc(var(--bottom-nav-space)+8px)]",
          // Нижняя панель исчезает с 768 — с неё же снимается и отступ под неё.
          "md:pb-4",
          "lg:flex-1 lg:items-stretch lg:overflow-hidden lg:px-[var(--container-pad)] lg:pb-0",
          // 240 + 680 + 320 и промежутки — уже 1288 при контейнере 1560:
          // без выравнивания по центру колонки прижались бы влево, оставив
          // справа пустую полосу. Когда правой колонки нет, центрировать
          // нечего: две колонки уезжали бы вправо от левого края экрана.
          narrowCenter && rightColumn !== false && "xl:justify-center",
        )}
      >
        {sidebar === false ? null : (sidebar ?? <Sidebar collapsed={navCollapsed} />)}
        {/* Center column: the only scroll zone on desktop. */}
        <main
          className={cn(
            "min-w-0 flex-1 lg:overflow-y-auto",
            narrowCenter && "xl:max-w-[680px]",
            rightColumn === false &&
              "lg:mr-[calc(-1*var(--container-pad))] lg:pr-[var(--container-pad)]",
          )}
        >
          {children}
          {footer && <AppFooter />}
        </main>
        {rightColumn === false ? null : (rightColumn ?? <DirectionsRightRail />)}
      </div>
      {hideBottomNav ? null : <BottomNav />}
    </div>
  );
}
