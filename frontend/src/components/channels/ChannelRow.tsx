import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { toast } from "@/lib/toast";
import { setChannelSubscription, type Channel } from "@/lib/channels";
import { Button } from "@/components/ui/button";
import { EntityRow, EntityRowBadge } from "@/components/entity/EntityRow";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";

/**
 * Канал строкой в 64 px — та же строка, что у сообществ.
 *
 * Различие с сообществом только в действии: канал не «вступают», на него
 * подписываются, и владелец идёт не в «Управление», а к себе на страницу.
 * Подписчиков в строке не показываем поимённо — их список видит только
 * владелец, — но число подписчиков публично, как и у VK.
 */
export function ChannelRow({ channel, onChanged }: { channel: Channel; onChanged?: () => void }) {
  const { t } = useTranslation();
  const { requirePremium } = useGuestAccess();
  const [subscribed, setSubscribed] = useState(Boolean(channel.isSubscribed));
  const [busy, setBusy] = useState(false);
  const isOwner = Boolean(channel.isOwner || channel.canManage);

  const meta = [
    channel.category,
    channel.subscribers > 0
      ? t("pages.channelDetail.subscribersCount", { count: channel.subscribers })
      : t("pages.channels.noSubscribersYet"),
  ]
    .filter(Boolean)
    .join(" · ");

  const toggle = () => {
    if (busy) return;
    requirePremium(() => {
      void (async () => {
        setBusy(true);
        const next = !subscribed;
        try {
          await setChannelSubscription(channel.slug, next);
          setSubscribed(next);
          onChanged?.();
        } catch {
          toast.error(t("pages.channelDetail.subscribeFailed"));
        } finally {
          setBusy(false);
        }
      })();
    });
  };

  return (
    <EntityRow
      to="/channel/$id"
      params={{ id: channel.slug }}
      avatarUrl={channel.avatarImage}
      name={channel.name}
      badges={
        isOwner ? (
          <EntityRowBadge>{t("pages.shared.owner")}</EntityRowBadge>
        ) : channel.kind === "official" ? (
          <EntityRowBadge>{t("pages.communities.badgeOfficial")}</EntityRowBadge>
        ) : undefined
      }
      meta={meta}
      action={
        isOwner ? (
          <Button asChild size="sm" variant="outline">
            <Link to="/channel/$id" params={{ id: channel.slug }}>
              {t("pages.communities.rowManage")}
            </Link>
          </Button>
        ) : (
          <Button
            size="sm"
            variant={subscribed ? "outline" : "default"}
            onClick={toggle}
            disabled={busy}
          >
            {subscribed ? t("pages.shared.youSubscribed") : t("pages.shared.subscribe")}
          </Button>
        )
      }
    />
  );
}
