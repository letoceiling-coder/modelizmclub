import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { useEffect } from "react";
import { Clapperboard } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { GuestSectionStub, useGuestRouteBlocked } from "@/components/access/GuestSectionStub";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
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
  const { requireLogin } = useGuestAccess();
  // Гость получает окно входа сразу, как на /deals, — а не одну заглушку, где
  // окно ждёт нажатия «Войти». Приёмка 15.09: «гость → окно входа» без исключений.
  useEffect(() => {
    if (guestBlocked) requireLogin(() => {});
  }, [guestBlocked, requireLogin]);
  if (guestBlocked) {
    return (
      /*
        Та же раскладка, что и у самой страницы обзоров: гостевая заглушка —
        тот же раздел, и переход в него не должен двигать разметку. Раскладку
        задаёт правило маршрута (lib/layout/rails.ts): у обзоров панели нет,
        центр на всю ширину, заглушка стоит в нём по центру.
      */
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
