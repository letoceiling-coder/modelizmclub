import type { ReactNode } from "react";
import { Sidebar } from "./Sidebar";
import { RightCategories } from "./RightCategories";
import { BottomNav } from "./BottomNav";
import { MobileHeader } from "./MobileHeader";

interface Props {
  children: ReactNode;
  rightColumn?: ReactNode | false;
}

export function AppLayout({ children, rightColumn }: Props) {
  return (
    // 100dvh keeps the shell stable on mobile Safari/Chrome (no 100vh jump).
    // overflow-x-clip is a belt-and-braces guard against horizontal scroll.
    <div className="min-h-[100dvh] overflow-x-clip bg-background">
      <MobileHeader />
      {/*
        On desktop: align-items:stretch so sidebar/right-rail fill the row height,
        enabling their inner sticky containers to scroll independently.
        On mobile: pb leaves space for BottomNav.
      */}
      <div
        className="
          mx-auto flex w-full max-w-7xl items-start gap-6 px-3 pt-4
          pb-[calc(var(--bottom-nav-space)+8px)]
          lg:px-6 lg:pb-8
        "
      >
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
        {rightColumn === false ? null : rightColumn ?? <RightCategories />}
      </div>
      <BottomNav />
    </div>
  );
}
