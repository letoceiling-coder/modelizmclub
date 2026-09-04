import { useTranslation } from "react-i18next";
import { BannersAdminCard } from "@/components/admin/BannersAdminCard";
import { LandingBlocksAdminCard } from "@/components/admin/LandingBlocksAdminCard";
import { FaqAdminCard } from "@/components/admin/FaqAdminCard";
import { FeedGuestAccessAdminCard } from "@/components/admin/FeedGuestAccessAdminCard";
import { NotificationPolicyAdminCard } from "@/components/admin/NotificationPolicyAdminCard";
import { H, card } from "@/components/admin/adminShared";

/** Small admin sections that mostly delegate to a single existing card component. */

export function FeedBannersSection() {
  const { t } = useTranslation();
  return (
    <div>
      <H>{t("pages.adminFeedBanners.title")}</H>
      <BannersAdminCard cardStyle={card} />
    </div>
  );
}

export function LandingBlocksSection() {
  const { t } = useTranslation();
  return (
    <div>
      <H>{t("pages.adminLanding.title")}</H>
      <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginBottom: "16px" }}>
        {t("pages.adminLanding.subtitle")}
      </p>
      <LandingBlocksAdminCard cardStyle={card} />
      <FaqAdminCard cardStyle={card} />
    </div>
  );
}

export function FeedGuestAccessSection() {
  return (
    <div>
      <FeedGuestAccessAdminCard />
    </div>
  );
}

export function NotificationPolicySection() {
  return (
    <div>
      <NotificationPolicyAdminCard />
    </div>
  );
}
