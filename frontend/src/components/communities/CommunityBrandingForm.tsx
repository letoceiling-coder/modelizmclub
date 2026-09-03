import { useEffect, useRef, useState, type LucideIcon } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import {
  PROFILE_COVER_MAX_BYTES,
  PROFILE_IMAGE_ACCEPT,
  prepareProfileImageFile,
} from "@/lib/profile-image";
import { uploadMedia } from "@/lib/api/media";
import { updateCommunityBranding } from "@/lib/api/communities";
import type { Community } from "@/lib/mock";
import { toast } from "@/lib/toast";
import { isDemoMode } from "@/lib/demo-mode";

interface Props {
  community: Community;
  Icon: LucideIcon;
  onUpdated: (community: Community) => void;
}

export function CommunityBrandingForm({ community, Icon, onUpdated }: Props) {
  const [avatarUrl, setAvatarUrl] = useState(community.avatarImage ?? "");
  const [coverUrl, setCoverUrl] = useState(community.coverImage ?? "");
  const [brokenCover, setBrokenCover] = useState(false);
  const [brokenAvatar, setBrokenAvatar] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarUrl(community.avatarImage ?? "");
    setCoverUrl(community.coverImage ?? "");
    setBrokenCover(false);
    setBrokenAvatar(false);
  }, [community.avatarImage, community.coverImage]);

  const saveBranding = async (patch: {
    avatar_media_uuid?: string | null;
    cover_media_uuid?: string | null;
  }) => {
    if (isDemoMode()) {
      toast("В демо-режиме оформление сохраняется только локально");
      return community;
    }
    return updateCommunityBranding(community.id, patch);
  };

  const onAvatarFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPendingAvatar(await prepareProfileImageFile(file));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обработать файл");
    }
  };

  const onCoverFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    try {
      setPendingCover(await prepareProfileImageFile(file, PROFILE_COVER_MAX_BYTES));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Не удалось обработать файл");
    }
  };

  const uploadAvatar = async (blob: Blob) => {
    setPendingAvatar(null);
    setAvatarUploading(true);
    try {
      const file = new File([blob], "community-avatar.jpg", { type: "image/jpeg" });
      const media = await uploadMedia(file, "avatar");
      const updated = await saveBranding({ avatar_media_uuid: media.uuid });
      setAvatarUrl(updated.avatarImage ?? media.url ?? "");
      setBrokenAvatar(false);
      onUpdated(updated);
      toast.success(
        "Изменения отправлены на модерацию. После проверки они будут опубликованы автоматически.",
      );
    } catch {
      toast.error("Не удалось загрузить аватар");
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
      setBrokenAvatar(false);
      onUpdated(updated);
      toast.success(
        "Изменения отправлены на модерацию. После проверки они будут опубликованы автоматически.",
      );
    } catch {
      toast.error("Не удалось удалить аватар");
    } finally {
      setAvatarUploading(false);
    }
  };

  const uploadCover = async (blob: Blob) => {
    setPendingCover(null);
    setCoverUploading(true);
    try {
      const file = new File([blob], "community-cover.jpg", { type: "image/jpeg" });
      const media = await uploadMedia(file, "banner");
      const updated = await saveBranding({ cover_media_uuid: media.uuid });
      setCoverUrl(updated.coverImage ?? media.url ?? "");
      setBrokenCover(false);
      onUpdated(updated);
      toast.success(
        "Изменения отправлены на модерацию. После проверки они будут опубликованы автоматически.",
      );
    } catch {
      toast.error("Не удалось загрузить обложку");
    } finally {
      setCoverUploading(false);
    }
  };

  const removeCover = async () => {
    setPendingCover(null);
    setCoverUploading(true);
    try {
      const updated = await saveBranding({ cover_media_uuid: null });
      setCoverUrl("");
      onUpdated(updated);
      toast.success(
        "Изменения отправлены на модерацию. После проверки они будут опубликованы автоматически.",
      );
    } catch {
      toast.error("Не удалось удалить обложку");
    } finally {
      setCoverUploading(false);
    }
  };

  const showCover = Boolean(coverUrl) && !brokenCover;
  const showAvatar = Boolean(avatarUrl) && !brokenAvatar;

  return (
    <>
      <div className="space-y-4">
        <div>
          <div className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
            Аватар
          </div>
          <div className="mt-2 flex items-center gap-3">
            <div
              className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden"
              style={{
                background: "transparent",
                border: "2px solid var(--border)",
                borderRadius: 16,
              }}
            >
              {showAvatar ? (
                <img
                  src={avatarUrl}
                  width={96}
                  height={96}
                  loading="lazy"
                  decoding="async"
                  alt=""
                  className="h-full w-full object-cover"
                  onError={() => setBrokenAvatar(true)}
                />
              ) : (
                <div
                  className="grid h-full w-full place-items-center"
                  style={{ background: "var(--accent-soft)" }}
                >
                  <Icon size={28} style={{ color: "var(--accent)" }} />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <input
                ref={avatarInputRef}
                type="file"
                accept={PROFILE_IMAGE_ACCEPT}
                className="hidden"
                onChange={onAvatarFile}
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="rounded-[10px] gap-1.5"
                disabled={avatarUploading}
                onClick={() => avatarInputRef.current?.click()}
              >
                <Camera size={14} /> {avatarUploading ? "Загрузка…" : "Изменить аватар"}
              </Button>
              <p className="mt-1 text-[11px]" style={{ color: "var(--foreground-50)" }}>
                JPG, PNG, WEBP · до 5 МБ · 480×480
              </p>
            </div>
          </div>
        </div>

        <div>
          <div className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
            Обложка
          </div>
          <div
            className="mt-2 overflow-hidden rounded-[10px]"
            style={{
              background: showCover
                ? "transparent"
                : "linear-gradient(135deg, var(--accent), var(--accent-muted))",
              border: "1px solid var(--border)",
            }}
          >
            {showCover ? (
              <img
                src={coverUrl}
                width={1200}
                height={300}
                loading="lazy"
                decoding="async"
                alt=""
                className="h-24 w-full object-cover"
                onError={() => setBrokenCover(true)}
              />
            ) : (
              <div className="grid h-24 place-items-center opacity-40">
                <Icon size={40} color="#fff" />
              </div>
            )}
          </div>
          <div className="mt-2">
            <input
              ref={coverInputRef}
              type="file"
              accept={PROFILE_IMAGE_ACCEPT}
              className="hidden"
              onChange={onCoverFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-[10px] gap-1.5"
              disabled={coverUploading}
              onClick={() => coverInputRef.current?.click()}
            >
              <Camera size={14} /> {coverUploading ? "Загрузка…" : "Изменить обложку"}
            </Button>
            <p className="mt-1 text-[11px]" style={{ color: "var(--foreground-50)" }}>
              JPG, PNG, WEBP · до 10 МБ · 1400×400
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
        title="Аватар сообщества"
        onCancel={() => setPendingAvatar(null)}
        onCropped={uploadAvatar}
        onDelete={avatarUrl ? removeAvatar : undefined}
      />
      <PhotoEditorDialog
        file={pendingCover}
        aspect={3.5}
        lockAspect
        shape="rect"
        lockShape
        outputWidth={1400}
        outputHeight={400}
        title="Обложка сообщества"
        safeZonePreset="cover-wide"
        onCancel={() => setPendingCover(null)}
        onCropped={uploadCover}
        onDelete={coverUrl ? removeCover : undefined}
      />
    </>
  );
}
