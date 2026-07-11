import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Sidebar } from "./Sidebar";
import { RightCategories } from "./RightCategories";
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
}

export function AppLayout({ children, rightColumn, navCollapsed, footer, sidebar, hideMobileHeader }: Props) {
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
        className="
          mx-auto flex w-full max-w-[var(--container-max)] items-start gap-6 px-3 pt-4
          pb-[calc(var(--bottom-nav-space)+8px)]
          lg:flex-1 lg:items-stretch lg:overflow-hidden lg:px-[var(--container-pad)] lg:pb-0
        "
      >
        {sidebar === false ? null : sidebar ?? <Sidebar collapsed={navCollapsed} />}
        {/* Center column: the only scroll zone on desktop. */}
        <main
          className={cn(
            "min-w-0 flex-1 lg:overflow-y-auto",
            rightColumn === false && "lg:mr-[calc(-1*var(--container-pad))] lg:pr-[var(--container-pad)]",
          )}
        >
          {children}
          {footer && <AppFooter />}
        </main>
        {rightColumn === false ? null : rightColumn ?? <RightCategories />}
      </div>
      <BottomNav />
    </div>
  );
}
