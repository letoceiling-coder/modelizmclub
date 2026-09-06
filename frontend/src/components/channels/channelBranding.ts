import { updateChannelBranding, type Channel } from "@/lib/channels";
import { isDemoMode } from "@/lib/demo-mode";
import { toast } from "@/lib/toast";
import type { BrandingConfig, BrandingLabels } from "@/components/entity/useEntityBranding";

type Translate = (key: string) => string;

/** Тексты канала уже лежат в словаре — берём их оттуда, а не дублируем. */
export function channelBrandingLabels(t: Translate): BrandingLabels {
  return {
    fileProcessFailed: t("components.channelBranding.fileProcessFailed"),
    avatarUpdated: t("components.channelBranding.avatarUpdated"),
    avatarUploadFailed: t("components.channelBranding.avatarUploadFailed"),
    avatarRemoved: t("components.channelBranding.avatarRemoved"),
    avatarRemoveFailed: t("components.channelBranding.avatarRemoveFailed"),
    coverUpdated: t("components.channelBranding.bannerUpdated"),
    coverUploadFailed: t("components.channelBranding.bannerUploadFailed"),
    coverRemoved: t("components.channelBranding.bannerRemoved"),
    coverRemoveFailed: t("components.channelBranding.bannerRemoveFailed"),
  };
}

/**
 * Как канал сохраняет оформление: адресуется по slug, обложка называется
 * `banner_media_uuid`. Общая часть ничего из этого не знает.
 */
export function channelBrandingConfig(
  channel: Channel,
  onUpdated: (channel: Channel) => void,
  t: Translate,
): BrandingConfig<Channel> {
  return {
    avatar: channel.avatarImage,
    cover: channel.bannerImage,
    fileStem: "channel",
    labels: channelBrandingLabels(t),
    read: (updated) => ({ avatar: updated.avatarImage, cover: updated.bannerImage }),
    onUpdated,
    save: async (patch) => {
      if (isDemoMode()) {
        toast(t("components.channelBranding.demoLocalOnly"));
        return channel;
      }
      return updateChannelBranding(channel.slug, {
        ...(patch.avatar !== undefined ? { avatar_media_uuid: patch.avatar } : {}),
        ...(patch.cover !== undefined ? { banner_media_uuid: patch.cover } : {}),
      });
    },
  };
}
