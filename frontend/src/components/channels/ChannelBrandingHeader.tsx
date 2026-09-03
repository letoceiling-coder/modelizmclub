import { useEffect, useRef, useState } from "react";
import { Camera } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import {
  PROFILE_COVER_MAX_BYTES,
  PROFILE_IMAGE_ACCEPT,
  prepareProfileImageFile,
  blobToImageFile,
} from "@/lib/profile-image";
import { uploadMedia } from "@/lib/api/media";
import { updateChannelBranding, type Channel } from "@/lib/channels";
import { toast } from "@/lib/toast";
import { isDemoMode } from "@/lib/demo-mode";
import { Img } from "@/components/ui/Img";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

interface Props {
  channel: Channel;
  editable: boolean;
  onUpdated: (channel: Channel) => void;
}

export function ChannelBrandingHeader({ channel, editable, onUpdated }: Props) {
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
      const file = blobToImageFile(blob, "channel-avatar");
      const media = await uploadMedia(file, "avatar");
      const updated = await saveBranding({ avatar_media_uuid: media.uuid });
      if (updated) {
        setAvatarUrl(updated.avatarImage ?? media.url ?? "");
        onUpdated(updated);
      } else {
        setAvatarUrl(media.url ?? URL.createObjectURL(file));
      }
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
      if (updated) onUpdated(updated);
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
      const file = blobToImageFile(blob, "channel-banner");
      const media = await uploadMedia(file, "banner");
      const updated = await saveBranding({ banner_media_uuid: media.uuid });
      if (updated) {
        setBannerUrl(updated.bannerImage ?? media.url ?? "");
        onUpdated(updated);
      } else {
        setBannerUrl(media.url ?? URL.createObjectURL(file));
      }
      setBrokenBanner(false);
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
      if (updated) onUpdated(updated);
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
      <div className="relative h-28 sm:h-36">
        {showBanner ? (
          <Img
            src={bannerUrl}
            width={1200}
            height={300}
            alt=""
            className="h-full w-full object-cover"
            onError={() => setBrokenBanner(true)}
          />
        ) : (
          <div className="h-full w-full" style={{ background: channel.bannerColor }} />
        )}
        {editable && (
          <>
            <input
              ref={bannerInputRef}
              type="file"
              accept={PROFILE_IMAGE_ACCEPT}
              className="hidden"
              onChange={onBannerFile}
            />
            <button
              type="button"
              aria-label={t("components.channelBranding.changeBannerAria")}
              onClick={() => bannerInputRef.current?.click()}
              disabled={bannerUploading}
              className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium transition-colors hover:brightness-110 disabled:opacity-60"
              style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
            >
              <Camera size={14} /> {t("components.channelBranding.changeBanner")}
            </button>
            <p
              className="absolute bottom-2 left-3 hidden text-[11px] sm:block"
              style={{ color: "rgba(255,255,255,0.85)", textShadow: "0 1px 2px rgba(0,0,0,0.45)" }}
            >
              {t("components.channelBranding.bannerHintShort")}
            </p>
          </>
        )}
      </div>

      <div className="px-4 pb-4 sm:px-5 sm:pb-5">
        <div className="-mt-8 sm:-mt-10 grid grid-cols-[auto_minmax(0,1fr)] items-end gap-3">
          <div className="relative shrink-0">
            <Avatar
              className="h-16 w-16 sm:h-20 sm:w-20"
              style={{
                borderRadius: 16,
                border: "3px solid var(--background)",
                background: avatarUrl ? "transparent" : channel.avatarColor,
              }}
            >
              {avatarUrl ? <AvatarImage src={avatarUrl} alt="" className="h-full w-full object-cover" /> : null}
              <AvatarFallback
                className="font-display text-[24px] font-bold text-white sm:text-[28px]"
                style={{ background: channel.avatarColor, borderRadius: 13 }}
              >
                {initials(channel.name)}
              </AvatarFallback>
            </Avatar>
            {editable && (
              <>
                <input
                  ref={avatarInputRef}
                  type="file"
                  accept={PROFILE_IMAGE_ACCEPT}
                  className="hidden"
                  onChange={onAvatarFile}
                />
                <button
                  type="button"
                  aria-label={t("components.channelBranding.changeAvatarAria")}
                  onClick={() => avatarInputRef.current?.click()}
                  disabled={avatarUploading}
                  className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-2 disabled:opacity-60"
                  style={{ background: "var(--accent)", color: "#fff", borderColor: "var(--background)" }}
                >
                  <Camera size={13} />
                </button>
              </>
            )}
          </div>
        </div>
        {editable && (
          <p className="mt-2 text-[11px]" style={{ color: "var(--foreground-50)" }}>
            {t("components.channelBranding.avatarHintShort")}
          </p>
        )}
      </div>

      <PhotoEditorDialog
        file={pendingAvatar}
        aspect={1}
        lockAspect
        shape="rect"
        lockShape
        outputWidth={480}
        outputHeight={480}
        outputMime="image/jpeg"
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
        safeZonePreset="cover-wide"
        title={t("components.channelBranding.bannerEditorTitle")}
        onCancel={() => setPendingBanner(null)}
        onCropped={uploadBanner}
        onDelete={bannerUrl ? removeBanner : undefined}
      />
    </>
  );
}
