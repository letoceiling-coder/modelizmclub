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
    <div className="min-h-screen bg-background">
      <MobileHeader />
      <div className="mx-auto flex w-full max-w-7xl items-start gap-6 px-3 pb-24 pt-4 lg:px-6 lg:pb-8">
        <Sidebar />
        <main className="min-w-0 flex-1">{children}</main>
        {rightColumn === false ? null : rightColumn ?? <RightCategories />}
      </div>
      <BottomNav />
    </div>
  );
}
