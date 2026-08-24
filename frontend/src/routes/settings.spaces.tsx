import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Radio, Users2, Plus, ChevronRight } from "lucide-react";
import { useChannels, isChannelOwner } from "@/lib/channels";
import { useOwnedCommunities } from "@/lib/api/communities";
import { VerificationBanner } from "@/components/auth/VerificationBanner";
import { useStore, selectors } from "@/lib/store";
import type { EntityKind } from "@/lib/api/entity-requests";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/settings/spaces")({
  head: () => ({ meta: [{ title: i18n.t("pages.settings.spacesMetaTitle") }] }),
  component: SettingsSpacesPage,
});

function SettingsSpacesPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const me = useStore(selectors.currentUser);
  const { channels } = useChannels();
  const myChannel = channels.find((c) => isChannelOwner(c, me.id));
  const { communities: ownedCommunities } = useOwnedCommunities();
  const myCommunity = ownedCommunities[0];

  const openRequest = (kind: EntityKind) => {
    if (kind === "channel") {
      void navigate({ to: "/channels/new" });
      return;
    }
    void navigate({ to: "/communities/new" });
  };

  return (
    <div className="flex flex-col gap-[16px]">
      <VerificationBanner />
      <h1 className="text-[20px] font-bold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
        {t("pages.settings.spacesTitle")}
      </h1>

      <SpaceCard
        icon={<Radio size={20} />}
        title={t("pages.settings.spacesChannel")}
        subtitle={myChannel ? myChannel.name : t("pages.settings.spacesNoChannel")}
        action={
          myChannel ? (
            <Link
              to="/channel/$id"
              params={{ id: myChannel.slug }}
              className={secondaryActionClass}
              style={secondaryActionStyle}
            >
              {t("pages.settings.spacesMyChannel")} <ChevronRight size={16} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openRequest("channel")}
              className={primaryActionClass}
              style={primaryActionStyle}
            >
              <Plus size={16} /> {t("pages.settings.spacesCreateChannel")}
            </button>
          )
        }
      />

      <SpaceCard
        icon={<Users2 size={20} />}
        title={t("pages.settings.spacesCommunity")}
        subtitle={myCommunity ? myCommunity.name : t("pages.settings.spacesNoCommunity")}
        action={
          myCommunity ? (
            <Link
              to="/communities/$id"
              params={{ id: myCommunity.id }}
              className={secondaryActionClass}
              style={secondaryActionStyle}
            >
              {t("pages.settings.spacesMyCommunity")} <ChevronRight size={16} />
            </Link>
          ) : (
            <button
              type="button"
              onClick={() => openRequest("community")}
              className={primaryActionClass}
              style={primaryActionStyle}
            >
              <Plus size={16} /> {t("pages.settings.spacesCreateCommunity")}
            </button>
          )
        }
      />
    </div>
  );
}

const primaryActionClass =
  "inline-flex h-10 w-full min-w-[220px] items-center justify-center gap-1.5 rounded-[10px] px-4 text-[14px] font-semibold whitespace-nowrap transition-opacity hover:opacity-90 sm:w-[220px]";

const secondaryActionClass =
  "inline-flex h-10 w-full min-w-[220px] items-center justify-center gap-1.5 rounded-[10px] border px-4 text-[14px] font-semibold whitespace-nowrap transition-colors hover:bg-[var(--background-surface)] sm:w-[220px]";

const primaryActionStyle = { background: "var(--accent)", color: "var(--accent-foreground)" } as const;
const secondaryActionStyle = { borderColor: "var(--border)", color: "var(--foreground)" } as const;

function SpaceCard({
  icon,
  title,
  subtitle,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  subtitle: string;
  action: React.ReactNode;
}) {
  return (
    <div
      className="grid grid-cols-1 gap-4 rounded-[14px] border p-4 sm:grid-cols-[44px_minmax(0,1fr)_220px] sm:items-start sm:gap-x-4"
      style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
    >
      <div
        className="grid h-11 w-11 shrink-0 place-items-center rounded-full sm:mt-[1px]"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        {icon}
      </div>
      <div className="min-w-0 sm:col-start-2 sm:row-start-1">
        <div className="text-[15px] font-semibold leading-tight" style={{ color: "var(--foreground)" }}>
          {title}
        </div>
        <div className="mt-1 text-[13px] leading-snug" style={{ color: "var(--foreground-50)" }}>
          {subtitle}
        </div>
      </div>
      <div className="sm:col-start-3 sm:row-start-1 sm:mt-[1px]">{action}</div>
    </div>
  );
}
