import { useTranslation } from "@/lib/i18n";

export function InvitedFriendsSection() {
  const { t } = useTranslation();
  return (
    <div className="py-8 text-center text-[14px]" style={{ color: "var(--foreground-50)" }}>
      {t("profile.emptyInvited")}
    </div>
  );
}
