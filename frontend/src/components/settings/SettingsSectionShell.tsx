import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";

/** Wrapper for a settings sub-section. On mobile it shows a back link to the
 *  section list; on desktop the persistent rail already provides navigation. */
export function SettingsSectionShell({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-[16px]">
      <Link
        to="/settings"
        className="lg:hidden inline-flex items-center gap-[4px] text-[13px]"
        style={{ color: "var(--foreground-50)" }}
      >
        <ChevronLeft size={16} /> Настройки
      </Link>
      <h1 className="font-display text-[22px] font-bold" style={{ color: "var(--foreground)", letterSpacing: "-0.02em" }}>
        {title}
      </h1>
      {children}
    </section>
  );
}
