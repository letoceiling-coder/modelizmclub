import { Link, useRouterState } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import {
  Newspaper,
  Users2,
  Radio,
  MessageSquare,
  Megaphone,
  UserPlus,
  ClipboardList,
  Plus,
  ExternalLink,
  Heart,
  Clapperboard,
  Settings,
  ShieldCheck,
  Wallet,
} from "lucide-react";
import { Icon as SlotIcon } from "@/components/ui/Icon";
import { navSlotKey } from "@/lib/icon-slots";
import { ROUTES, getActiveSection } from "@/lib/routes";
import { FeedbackDialog } from "@/components/feedback/FeedbackDialog";
import { InviteFriendNavLink } from "@/components/referral/InviteFriendNavLink";
import { InstallAppNavRow } from "@/components/pwa/InstallAppNavRow";
import { useFeatureFlag } from "@/lib/config/featureFlags";
import { useMySubscription, formatSubscriptionEndDate } from "@/lib/subscription";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import { NAV_ROUTE_TO_ACTION } from "@/lib/feed-guest-access/routes";
import { useUnreadMessagesTotal } from "@/lib/messenger";

interface Item {
  to:
    | "/feed"
    | "/ads"
    | "/ads/new"
    | "/my-ads"
    | "/deals"
    | "/favorites"
    | "/communities"
    | "/reviews"
    | "/channels"
    | "/messenger"
    | "/friends"
    | "/settings"
    | "/settings/wallet";
  labelKey: string;
  icon: typeof Newspaper;
  section: string;
  authOnly?: boolean;
}

interface NavGroup {
  titleKey?: string;
  items: Item[];
}

const COMMUNITY_ITEMS: Item[] = [
  { to: ROUTES.feed, labelKey: "nav.feed", icon: Newspaper, section: "feed" },
  { to: ROUTES.messenger, labelKey: "nav.messenger", icon: MessageSquare, section: "messenger" },
  { to: ROUTES.reviews, labelKey: "nav.reviews", icon: Clapperboard, section: "reviews" },
  { to: ROUTES.communities, labelKey: "nav.communities", icon: Users2, section: "communities" },
  { to: ROUTES.channels, labelKey: "nav.channels", icon: Radio, section: "channels" },
  { to: ROUTES.friends, labelKey: "nav.friends", icon: UserPlus, section: "friends" },
];

const ADS_ITEMS: Item[] = [
  { to: ROUTES.ads, labelKey: "nav.catalog", icon: Megaphone, section: "ads" },
  { to: ROUTES.adCreate, labelKey: "nav.adCreate", icon: Plus, section: "ad-create" },
  {
    to: ROUTES.myAds,
    labelKey: "nav.myAds",
    icon: ClipboardList,
    section: "my-ads",
    authOnly: true,
  },
  { to: ROUTES.deals, labelKey: "nav.deals", icon: ShieldCheck, section: "deals", authOnly: true },
];

const TAIL_ITEMS: Item[] = [
  {
    to: ROUTES.favorites,
    labelKey: "nav.favorites",
    icon: Heart,
    section: "favorites",
    authOnly: true,
  },
  {
    to: ROUTES.settings,
    labelKey: "nav.settings",
    icon: Settings,
    section: "settings",
    authOnly: true,
  },
  { to: ROUTES.wallet, labelKey: "nav.wallet", icon: Wallet, section: "wallet", authOnly: true },
];

const NAV_GROUPS: NavGroup[] = [
  { titleKey: "nav.sectionCommunity", items: COMMUNITY_ITEMS },
  { titleKey: "nav.sectionAds", items: ADS_ITEMS },
  { titleKey: undefined, items: TAIL_ITEMS },
];

function filterItems(items: Item[], communitiesEnabled: boolean, reviewsEnabled: boolean): Item[] {
  return items.filter(
    (i) =>
      (i.to !== ROUTES.communities || communitiesEnabled) &&
      (i.to !== ROUTES.reviews || reviewsEnabled),
  );
}

export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = getActiveSection(pathname);
  const { t } = useTranslation();
  const communitiesEnabled = useFeatureFlag("communitiesEnabled");
  const reviewsEnabled = useFeatureFlag("reviewsEnabled");
  const marketEnabled = useFeatureFlag("marketEnabled");
  const { sub } = useMySubscription();
  const { isGuest } = useGuestAccess();
  const unreadMessages = useUnreadMessagesTotal();

  const groups = NAV_GROUPS.map((group) => ({
    ...group,
    items: filterItems(group.items, communitiesEnabled, reviewsEnabled),
  })).filter((group) => group.items.length > 0);

  const flatItems = groups.flatMap((group) => group.items);

  const renderNavLink = (
    to: Item["to"],
    labelKey: string,
    section: string,
    active: boolean,
    compact = false,
    badge = 0,
  ) => {
    const actionKey = NAV_ROUTE_TO_ACTION[to] ?? "";
    const className = compact
      ? "grid h-10 w-10 place-items-center rounded-lg transition-colors hover:bg-muted"
      : `relative flex items-center gap-3 rounded-lg pl-3 pr-3 py-2 text-sm transition-colors ${active ? "bg-accent/10 text-primary font-medium" : "text-foreground hover:bg-muted"}`;
    const style = active
      ? compact
        ? { background: "var(--accent-soft)", color: "var(--accent)" }
        : {
            borderLeft: "3px solid var(--accent)",
            paddingLeft: 9,
            background: "var(--accent-soft)",
            color: "var(--accent)",
          }
      : compact
        ? { color: "var(--foreground-70)" }
        : undefined;

    const badgeEl =
      badge > 0 ? (
        <span
          className={
            compact
              ? "absolute -right-[7px] -top-[5px] grid min-w-[15px] place-items-center rounded-full px-[3px] tabular-nums"
              : "ml-auto grid min-h-[18px] min-w-[18px] place-items-center rounded-full px-[5px] tabular-nums"
          }
          style={{
            height: compact ? 15 : undefined,
            fontSize: compact ? 9 : 11,
            fontWeight: 700,
            color: "var(--accent-foreground)",
            background: "var(--accent)",
            boxShadow: compact ? "0 0 0 2px var(--background)" : undefined,
          }}
        >
          {badge > 9 ? "9+" : badge}
        </span>
      ) : null;

    if (actionKey) {
      return (
        <GuestGuardLink
          key={to}
          actionKey={actionKey}
          to={to}
          className={className}
          style={style}
          title={compact ? t(labelKey) : undefined}
          aria-label={t(labelKey)}
        >
          {compact ? (
            <span className="relative inline-flex">
              <SlotIcon slot={navSlotKey(section)} inheritColor className="h-5 w-5" />
              {badgeEl}
            </span>
          ) : (
            <>
              <SlotIcon slot={navSlotKey(section)} inheritColor className="h-5 w-5" />
              <span className="min-w-0 flex-1">{t(labelKey)}</span>
              {badgeEl}
            </>
          )}
        </GuestGuardLink>
      );
    }

    return (
      <Link
        key={to}
        to={to}
        className={className}
        style={style}
        title={compact ? t(labelKey) : undefined}
        aria-label={compact ? t(labelKey) : undefined}
      >
        {compact ? (
          <span className="relative inline-flex">
            <SlotIcon slot={navSlotKey(section)} inheritColor className="h-5 w-5" />
            {badgeEl}
          </span>
        ) : (
          <>
            <SlotIcon slot={navSlotKey(section)} inheritColor className="h-5 w-5" />
            <span className="min-w-0 flex-1">{t(labelKey)}</span>
            {badgeEl}
          </>
        )}
      </Link>
    );
  };

  const marketLink = (compact = false) =>
    marketEnabled ? (
      compact ? (
        <a
          href="https://modelizm23.ru"
          target="_blank"
          rel="noopener noreferrer"
          title={t("nav.market")}
          aria-label={t("nav.market")}
          className="grid h-10 w-10 place-items-center rounded-lg transition-colors hover:bg-muted"
          style={{ color: "var(--foreground-70)" }}
        >
          <SlotIcon slot="nav.market" inheritColor className="h-5 w-5" />
        </a>
      ) : (
        <a
          href="https://modelizm23.ru"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between gap-3 rounded-lg px-3 py-2 text-sm text-foreground hover:bg-muted"
        >
          <span className="flex items-center gap-3">
            <SlotIcon slot="nav.market" inheritColor className="h-5 w-5" />
            {t("nav.market")}
          </span>
          <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
        </a>
      )
    ) : null;

  const fullInner = (
    <div className="h-full space-y-1 overflow-y-auto overflow-x-hidden py-4 no-scrollbar">
      <nav className="space-y-4">
        {groups.map((group, index) => (
          <div key={group.titleKey ?? `tail-${index}`}>
            {group.titleKey && (
              <p
                className="mb-1 px-3 text-[11px] font-semibold uppercase tracking-wide"
                style={{ color: "var(--foreground-50)" }}
              >
                {t(group.titleKey)}
              </p>
            )}
            <div className="space-y-0.5">
              {group.items.map(({ to, labelKey, section }) =>
                renderNavLink(
                  to,
                  labelKey,
                  section,
                  activeSection === section,
                  false,
                  section === "messenger" ? unreadMessages : 0,
                ),
              )}
            </div>
          </div>
        ))}
        {marketLink()}
      </nav>

      <Link
        to={ROUTES.subscription}
        className="mt-4 flex items-center gap-[10px] rounded-xl px-3 py-[10px] text-xs transition-colors hover:bg-muted"
        style={{ background: "var(--background-surface)", border: "1px solid var(--border)" }}
      >
        <SlotIcon
          slot="nav.subscription"
          size={16}
          className="shrink-0"
          style={{ color: "var(--foreground-50)" }}
        />
        <span className="min-w-0">
          {!isGuest && sub?.is_active ? (
            <>
              <span className="block font-medium" style={{ color: "var(--foreground-70)" }}>
                {t("common.subscriptionActive")}
              </span>
              <span className="block text-[11px]" style={{ color: "var(--foreground-50)" }}>
                до {formatSubscriptionEndDate(sub)}
              </span>
            </>
          ) : (
            <>
              <span className="block font-medium" style={{ color: "var(--foreground-70)" }}>
                {t("nav.subscription", "Подписка")}
              </span>
              <span className="block text-[11px]" style={{ color: "var(--foreground-50)" }}>
                {t("common.subscriptionCta", "Оформить")}
              </span>
            </>
          )}
        </span>
      </Link>

      <div className="mt-2 space-y-0.5">
        {!isGuest && <InviteFriendNavLink />}
        <InstallAppNavRow />
        <FeedbackDialog />
      </div>
    </div>
  );

  if (!collapsed) {
    return <aside className="hidden lg:block w-60 shrink-0">{fullInner}</aside>;
  }

  return (
    <>
      <aside className="hidden lg:block xl:hidden w-60 shrink-0">{fullInner}</aside>
      <aside className="hidden xl:flex w-16 shrink-0 flex-col">
        <nav className="flex flex-col items-center gap-1 py-4">
          {flatItems.map(({ to, labelKey, section }) =>
            renderNavLink(
              to,
              labelKey,
              section,
              activeSection === section,
              true,
              section === "messenger" ? unreadMessages : 0,
            ),
          )}
          {marketLink(true)}
        </nav>
      </aside>
    </>
  );
}
