import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EntityBrandingForm } from "@/components/entity/EntityBrandingForm";
import { EntityBrandingEditors } from "@/components/entity/EntityBrandingEditors";
import { useEntityBranding } from "@/components/entity/useEntityBranding";
import { channelBrandingConfig } from "@/components/channels/channelBranding";
import { channelInitials } from "@/components/channels/channelInitials";
import type { Channel } from "@/lib/channels";

interface Props {
  channel: Channel;
  onUpdated: (channel: Channel) => void;
}

export function ChannelBrandingForm({ channel, onUpdated }: Props) {
  const { t } = useTranslation();
  const branding = useEntityBranding(channelBrandingConfig(channel, onUpdated, t));

  return (
    <>
      <EntityBrandingForm
        branding={branding}
        labels={{
          avatarLabel: t("components.channelBranding.avatarLabel"),
          avatarButton: t("components.channelBranding.changeAvatar"),
          avatarHint: t("components.channelBranding.avatarHint"),
          coverLabel: t("components.channelBranding.bannerLabel"),
          coverButton: t("components.channelBranding.changeBanner"),
          coverHint: t("components.channelBranding.bannerHint"),
          uploading: t("components.channelBranding.uploading"),
        }}
        coverBackground={channel.bannerColor}
        avatarFallback={
          <Avatar
            className="h-full w-full"
            style={{ borderRadius: 14, background: channel.avatarColor }}
          >
            {branding.avatarUrl ? (
              <AvatarImage src={branding.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : null}
            <AvatarFallback
              className="font-display text-[22px] font-bold text-white"
              style={{ background: channel.avatarColor, borderRadius: 14 }}
            >
              {channelInitials(channel.name)}
            </AvatarFallback>
          </Avatar>
        }
        coverFallback={
          <div
            className="grid h-24 place-items-center text-[12px]"
            style={{ color: "var(--foreground-50)" }}
          >
            {t("components.channelBranding.bannerNotUploaded")}
          </div>
        }
      />

      <EntityBrandingEditors
        branding={branding}
        avatar={{
          title: t("components.channelBranding.avatarEditorTitle"),
          outputMime: "image/jpeg",
        }}
        cover={{ title: t("components.channelBranding.bannerEditorTitle") }}
      />
    </>
  );
}
