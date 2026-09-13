import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { Radio } from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { EntityRequestForm } from "@/components/entity-requests/EntityRequestForm";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { useGate } from "@/lib/gate";
import { useCurrentUser } from "@/lib/session";
import { isFullyVerified, isStaffUser } from "@/lib/auth/verification";
import { useMySubscription } from "@/lib/subscription";
import { EmptyState } from "@/components/ui/empty-state";
import { Button } from "@/components/ui/button";
import i18n from "@/lib/i18n";

export const Route = createFileRoute("/channels/new")({
  head: () => ({ meta: [{ title: i18n.t("pages.channels.createChannel") }] }),
  component: ChannelNewPage,
});

function ChannelNewPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useCurrentUser();
  const { requireAccount, isGuest } = useGuestAccess();
  // Кто сюда дошёл вошедшим и не подходит — у того нет подтверждённого номера:
  // подписчик и подтвердивший номер проходят проверкой ниже, сервер пускает
  // любого с номером. Значит, окно — подтверждение, а не подписка (приёмка
  // 13.09, D2). requirePremium открыл бы после номера ещё и paywall.
  const { require: requireLevel } = useGate();
  const { sub, loading: subLoading } = useMySubscription();
  const eligible = isStaffUser(me) || isFullyVerified(me) || sub?.is_active === true;

  useEffect(() => {
    if (isGuest) {
      requireAccount(() => undefined, "/channels/new");
    }
  }, [isGuest, requireAccount]);

  if (isGuest || subLoading) {
    return (
      <AppLayout footer>
        <div className="py-10 text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>
          {t("common.loading")}
        </div>
      </AppLayout>
    );
  }

  if (!eligible) {
    return (
      <AppLayout footer>
        <div className="py-10">
          <EmptyState
            icon={Radio}
            title={t("pages.channels.createNeedAccessTitle")}
            description={t("pages.channels.createNeedAccessDesc")}
          >
            <Button
              className="rounded-[12px]"
              onClick={() =>
                void requireLevel("verified", () => undefined, {
                  intent: {
                    key: "navigate",
                    params: { to: "/channels/new" },
                    returnTo: "/channels/new",
                  },
                })
              }
            >
              {t("pages.channels.createNeedAccessAction")}
            </Button>
          </EmptyState>
        </div>
      </AppLayout>
    );
  }

  return (
    <AppLayout footer>
      <EntityRequestForm
        kind="channel"
        onClose={() => void navigate({ to: "/channels" })}
        onSubmitted={() => void navigate({ to: "/channels" })}
      />
    </AppLayout>
  );
}
