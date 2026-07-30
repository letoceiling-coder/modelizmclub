import { useEffect, useRef, useState, type LucideIcon } from "react";
import { Camera } from "lucide-react";
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
  editable: boolean;
  onUpdated: (community: Community) => void;
}

export function CommunityBrandingHeader({ community, Icon, editable, onUpdated }: Props) {
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

  const saveBranding = async (patch: { avatar_media_uuid?: string | null; cover_media_uuid?: string | null }) => {
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
      const nextUrl = updated.avatarImage ?? media.url ?? "";
      setAvatarUrl(nextUrl);
      setBrokenAvatar(false);
      onUpdated(updated);
      toast.success("Аватар сообщества обновлён");
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
      toast.success("Аватар удалён");
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
      const nextUrl = updated.coverImage ?? media.url ?? "";
      setCoverUrl(nextUrl);
      setBrokenCover(false);
      onUpdated(updated);
      toast.success("Обложка сообщества обновлена");
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
      toast.success("Обложка удалена");
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
      <div className="group relative">
        {showCover ? (
          <img
            src={coverUrl}
            alt=""
            className="w-full object-cover"
            style={{ height: "min(220px, 38vw)" }}
            onError={() => setBrokenCover(true)}
          />
        ) : (
          <div className="relative w-full overflow-hidden" style={{ height: 200, background: "linear-gradient(135deg, var(--accent), var(--accent-muted))" }}>
            <div className="absolute inset-0 grid place-items-center opacity-25">
              <Icon size={90} color="#fff" />
            </div>
          </div>
        )}
        {editable && (
          <>
            <input
              ref={coverInputRef}
              type="file"
              accept={PROFILE_IMAGE_ACCEPT}
              className="hidden"
              onChange={onCoverFile}
            />
            <button
              type="button"
              aria-label="Изменить обложку"
              onClick={() => coverInputRef.current?.click()}
              disabled={coverUploading}
              className="absolute right-3 top-3 inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[12px] font-medium opacity-100 transition-opacity hover:brightness-110 disabled:opacity-60 sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
              style={{ background: "rgba(0,0,0,0.55)", color: "#fff" }}
            >
              <Camera size={14} /> Изменить обложку
            </button>
            <p
              className="absolute bottom-2 left-3 hidden text-[11px] sm:block"
              style={{ color: "rgba(255,255,255,0.85)", textShadow: "0 1px 2px rgba(0,0,0,0.45)" }}
            >
              JPG, PNG, WEBP · до 10 МБ · рекомендуется 1400×400
            </p>
          </>
        )}
      </div>

      <div className="px-[16px] pb-4 sm:px-[24px] sm:pb-5">
        <div className="-mt-[36px] sm:-mt-10">
          <div className="relative inline-block shrink-0">
            <div
              className="grid h-[72px] w-[72px] shrink-0 place-items-center overflow-hidden sm:h-[88px] sm:w-[88px]"
              style={{ background: "var(--background)", border: "4px solid var(--background)", borderRadius: 18 }}
            >
              {showAvatar ? (
                <img src={avatarUrl} alt="" className="h-full w-full object-cover" onError={() => setBrokenAvatar(true)} />
              ) : (
                <div className="grid h-full w-full place-items-center" style={{ background: "var(--accent-soft)" }}>
                  <Icon size={34} style={{ color: "var(--accent)" }} />
                </div>
              )}
            </div>
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
                  aria-label="Изменить аватар"
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
          <p className="mt-2 max-w-[280px] text-[11px] leading-snug" style={{ color: "var(--foreground-50)" }}>
            Аватар: JPG, PNG, WEBP · до 5 МБ · рекомендуется 480×480
          </p>
        )}
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
        onCancel={() => setPendingCover(null)}
        onCropped={uploadCover}
        onDelete={coverUrl ? removeCover : undefined}
      />
    </>
  );
}
