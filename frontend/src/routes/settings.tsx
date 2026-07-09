import { createFileRoute, Outlet, useRouterState } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";
import { SettingsNav } from "@/components/settings/SettingsNav";

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
    <AppLayout rightColumn={false}>
      <div className="mx-auto w-full max-w-[920px] lg:grid lg:grid-cols-[260px_1fr] lg:gap-[28px]">
        {/* Section rail: desktop always; mobile only at the index */}
        <div className={atIndex ? "block" : "hidden lg:block"}>
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
