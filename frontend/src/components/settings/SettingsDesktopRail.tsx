import { Link } from "@tanstack/react-router";
import { ChevronLeft } from "lucide-react";
import { SettingsNav } from "./SettingsNav";

/** Desktop takeover nav for /settings/* — replaces the app Sidebar entirely
 *  (via AppLayout's `sidebar` slot) so only one left-column nav shows at a
 *  time, matching the Avito-style settings takeover pattern. Mobile is
 *  unaffected: the app Sidebar is already `hidden` below `lg` regardless. */
export function SettingsDesktopRail({ activePath }: { activePath: string }) {
  return (
    <aside className="hidden lg:block w-60 shrink-0">
      <div className="flex flex-col gap-1 py-4">
        <Link
          to="/feed"
          className="mb-2 inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm transition-colors hover:bg-muted"
          style={{ color: "var(--foreground-70)" }}
        >
          <ChevronLeft className="h-4 w-4" /> На главную
        </Link>
        <SettingsNav activePath={activePath} />
      </div>
    </aside>
  );
}
