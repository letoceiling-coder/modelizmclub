import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { Clapperboard } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GuestSectionStub, useGuestRouteBlocked } from "@/components/access/GuestSectionStub";
import { getFeatureFlags, loadFeatureFlagsFromServer } from "@/lib/config/featureFlags";

export const Route = createFileRoute("/reviews")({
  beforeLoad: async () => {
    await loadFeatureFlagsFromServer();
    if (!getFeatureFlags().reviewsEnabled) {
      throw redirect({ to: "/feed", replace: true });
    }
  },
  component: ReviewsSection,
});

function ReviewsSection() {
  const guestBlocked = useGuestRouteBlocked("route.reviews");
  if (guestBlocked) {
    return (
      <AppLayout>
        <div className="mx-auto w-full max-w-[720px] px-[16px] py-[48px]">
          <GuestSectionStub
            icon={Clapperboard}
            title="Чтобы смотреть обзоры, войдите в аккаунт"
            description="Видеообзоры сборок и комментарии доступны зарегистрированным пользователям."
          />
        </div>
      </AppLayout>
    );
  }
  return <Outlet />;
}
