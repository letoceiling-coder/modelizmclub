import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { SettingsNav } from "@/components/settings/SettingsNav";
import { SettingsDesktopRail } from "@/components/settings/SettingsDesktopRail";

export const Route = createFileRoute("/settings")({
  head: () => ({ meta: [{ title: "Настройки — МоДелизМ" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    await requireAuth(location);
  },
  component: SettingsLayout,
});

function SettingsLayout() {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const atIndex = pathname === "/settings";
  return (
    <AppLayout rightColumn={false} sidebar={<SettingsDesktopRail activePath={pathname} />}>
      <div className="mx-auto w-full max-w-[720px]">
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
