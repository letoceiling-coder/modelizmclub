import { updateCommunityBranding } from "@/lib/api/communities";
import { isDemoMode } from "@/lib/demo-mode";
import { toast } from "@/lib/toast";
import type { BrandingConfig, BrandingLabels } from "@/components/entity/useEntityBranding";
import type { Community } from "@/lib/mock";

/**
 * Оформление сообщества проходит модерацию, поэтому ответ — не «обновлено»,
 * а обещание опубликовать после проверки.
 */
const MODERATION_NOTICE =
  "Изменения отправлены на модерацию. После проверки они будут опубликованы автоматически.";

const COMMUNITY_LABELS: BrandingLabels = {
  fileProcessFailed: "Не удалось обработать файл",
  avatarUpdated: MODERATION_NOTICE,
  avatarUploadFailed: "Не удалось загрузить аватар",
  avatarRemoved: MODERATION_NOTICE,
  avatarRemoveFailed: "Не удалось удалить аватар",
  coverUpdated: MODERATION_NOTICE,
  coverUploadFailed: "Не удалось загрузить обложку",
  coverRemoved: MODERATION_NOTICE,
  coverRemoveFailed: "Не удалось удалить обложку",
};

/**
 * Как сообщество сохраняет оформление: свой адрес, своё имя поля обложки
 * (`cover_media_uuid`) и свой ответ в демо-режиме.
 */
export function communityBrandingConfig(
  community: Community,
  onUpdated: (community: Community) => void,
  labels: BrandingLabels = COMMUNITY_LABELS,
): BrandingConfig<Community> {
  return {
    avatar: community.avatarImage,
    cover: community.coverImage,
    fileStem: "community",
    labels,
    read: (updated) => ({ avatar: updated.avatarImage, cover: updated.coverImage }),
    onUpdated,
    save: async (patch) => {
      if (isDemoMode()) {
        toast("В демо-режиме оформление сохраняется только локально");
        return community;
      }
      return updateCommunityBranding(community.id, {
        ...(patch.avatar !== undefined ? { avatar_media_uuid: patch.avatar } : {}),
        ...(patch.cover !== undefined ? { cover_media_uuid: patch.cover } : {}),
      });
    },
  };
}
