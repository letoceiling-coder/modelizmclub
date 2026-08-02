import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import {
  PROFILE_COVER_MAX_BYTES,
  PROFILE_IMAGE_ACCEPT,
  prepareProfileImageFile,
} from "@/lib/profile-image";
import { uploadMedia } from "@/lib/api/media";
import { updateChannelBranding, type Channel } from "@/lib/channels";
import { toast } from "@/lib/toast";
import { isDemoMode } from "@/lib/demo-mode";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

interface Props {
  channel: Channel;
  onUpdated: (channel: Channel) => void;
}

export function ChannelBrandingForm({ channel, onUpdated }: Props) {
  const { t } = useTranslation();
  const [avatarUrl, setAvatarUrl] = useState(channel.avatarImage ?? "");
  const [bannerUrl, setBannerUrl] = useState(channel.bannerImage ?? "");
  const [brokenBanner, setBrokenBanner] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [bannerUploading, setBannerUploading] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingBanner, setPendingBanner] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarUrl(channel.avatarImage ?? "");
    setBannerUrl(channel.bannerImage ?? "");
    setBrokenBanner(false);
  }, [channel.avatarImage, channel.bannerImage]);

  const saveBranding = async (patch: { avatar_media_uuid?: string | null; banner_media_uuid?: string | null }) => {
    if (isDemoMode()) {
      toast(t("components.channelBranding.demoLocalOnly"));
      return channel;
    }
    return updateChannelBranding(channel.slug, patch);
  };

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPendingAvatar(await prepareProfileImageFile(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("components.channelBranding.fileProcessFailed"));
    }
  };

  const onBannerFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPendingBanner(await prepareProfileImageFile(file, PROFILE_COVER_MAX_BYTES));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("components.channelBranding.fileProcessFailed"));
    }
  };

  const uploadAvatar = async (blob: Blob) => {
    setPendingAvatar(null);
    setAvatarUploading(true);
    try {
      const file = new File([blob], "channel-avatar.jpg", { type: "image/jpeg" });
      const media = await uploadMedia(file, "avatar");
      const updated = await saveBranding({ avatar_media_uuid: media.uuid });
      setAvatarUrl(updated.avatarImage ?? media.url ?? "");
      onUpdated(updated);
      toast.success(t("components.channelBranding.avatarUpdated"));
    } catch {
      toast.error(t("components.channelBranding.avatarUploadFailed"));
    } finally {
      setAvatarUploading(false);
    }
  };

  const removeAvatar = async () => {
    setPendingAvatar(null);
    setAvatarUploading(true);
    try {
      const updated = await saveBranding({ avatar_media_uuid: null });
      setAvatarUrl("");
      onUpdated(updated);
      toast.success(t("components.channelBranding.avatarRemoved"));
    } catch {
      toast.error(t("components.channelBranding.avatarRemoveFailed"));
    } finally {
      setAvatarUploading(false);
    }
  };

  const uploadBanner = async (blob: Blob) => {
    setPendingBanner(null);
    setBannerUploading(true);
    try {
      const file = new File([blob], "channel-banner.jpg", { type: "image/jpeg" });
      const media = await uploadMedia(file, "banner");
      const updated = await saveBranding({ banner_media_uuid: media.uuid });
      setBannerUrl(updated.bannerImage ?? media.url ?? "");
      setBrokenBanner(false);
      onUpdated(updated);
      toast.success(t("components.channelBranding.bannerUpdated"));
    } catch {
      toast.error(t("components.channelBranding.bannerUploadFailed"));
    } finally {
      setBannerUploading(false);
    }
  };

  const removeBanner = async () => {
    setPendingBanner(null);
    setBannerUploading(true);
    try {
      const updated = await saveBranding({ banner_media_uuid: null });
      setBannerUrl("");
      onUpdated(updated);
      toast.success(t("components.channelBranding.bannerRemoved"));
    } catch {
      toast.error(t("components.channelBranding.bannerRemoveFailed"));
    } finally {
      setBannerUploading(false);
    }
  };

  const showBanner = Boolean(bannerUrl) && !brokenBanner;

  return (
    <>
      <div className="space-y-4">
        <div>
          <div className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("components.channelBranding.avatarLabel")}</div>
          <div className="mt-2 flex items-center gap-3">
            <Avatar
              className="h-16 w-16"
              style={{ borderRadius: 16, border: "2px solid var(--border)", background: channel.avatarColor }}
            >
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" className="object-cover" /> : null}
              <AvatarFallback
                className="font-display text-[22px] font-bold text-white"
                style={{ background: channel.avatarColor, borderRadius: 14 }}
              >
                {initials(channel.name)}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <input ref={avatarInputRef} type="file" accept={PROFILE_IMAGE_ACCEPT} className="hidden" onChange={onAvatarFile} />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-[10px] gap-1.5"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
              >
                <Camera size={14} /> {avatarUploading ? t("components.channelBranding.uploading") : t("components.channelBranding.changeAvatar")}
              </Button>
              <p className="mt-1 text-[11px]" style={{ color: "var(--foreground-50)" }}>
                {t("components.channelBranding.avatarHint")}
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>{t("components.channelBranding.bannerLabel")}</div>
          <div
            className="mt-2 overflow-hidden rounded-[10px]"
            style={{ background: showBanner ? "transparent" : channel.bannerColor, border: "1px solid var(--border)" }}
          >
            {showBanner ? (
              <img src={bannerUrl} alt="" className="h-24 w-full object-cover" onError={() => setBrokenBanner(true)} />
            ) : (
              <div className="grid h-24 place-items-center text-[12px]" style={{ color: "var(--foreground-50)" }}>
                {t("components.channelBranding.bannerNotUploaded")}
              </div>
            )}
          </div>
          <div className="mt-2">
            <input ref={bannerInputRef} type="file" accept={PROFILE_IMAGE_ACCEPT} className="hidden" onChange={onBannerFile} />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-[10px] gap-1.5"
              disabled={bannerUploading}
              onClick={() => bannerInputRef.current?.click()}
            >
              <Camera size={14} /> {bannerUploading ? t("components.channelBranding.uploading") : t("components.channelBranding.changeBanner")}
            </Button>
            <p className="mt-1 text-[11px]" style={{ color: "var(--foreground-50)" }}>
              {t("components.channelBranding.bannerHint")}
            </p>
          </div>
        </div>
      </div>

      <PhotoEditorDialog
        file={pendingAvatar}
        aspect={1}
        lockAspect
        shape="circle"
        lockShape
        outputWidth={480}
        outputHeight={480}
        title={t("components.channelBranding.avatarEditorTitle")}
        onCancel={() => setPendingAvatar(null)}
        onCropped={uploadAvatar}
        onDelete={avatarUrl ? removeAvatar : undefined}
      />
      <PhotoEditorDialog
        file={pendingBanner}
        aspect={3.5}
        lockAspect
        shape="rect"
        lockShape
        outputWidth={1400}
        outputHeight={400}
        title={t("components.channelBranding.bannerEditorTitle")}
        onCancel={() => setPendingBanner(null)}
        onCropped={uploadBanner}
        onDelete={bannerUrl ? removeBanner : undefined}
      />
    </>
  );
}
