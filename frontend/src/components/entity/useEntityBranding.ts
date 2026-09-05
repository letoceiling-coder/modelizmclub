import { useEffect, useRef, useState } from "react";
import { uploadMedia } from "@/lib/api/media";
import {
  PROFILE_COVER_MAX_BYTES,
  PROFILE_IMAGE_ACCEPT,
  blobToImageFile,
  prepareProfileImageFile,
} from "@/lib/profile-image";
import { toast } from "@/lib/toast";

export { PROFILE_IMAGE_ACCEPT };

/** Тексты — параметр, а не флаг: у сообщества они свои, у канала свои. */
export interface BrandingLabels {
  fileProcessFailed: string;
  avatarUpdated: string;
  avatarUploadFailed: string;
  avatarRemoved: string;
  avatarRemoveFailed: string;
  coverUpdated: string;
  coverUploadFailed: string;
  coverRemoved: string;
  coverRemoveFailed: string;
}

/** Что меняется: два адреса. Как они называются у сущности — знает вызывающий. */
export interface BrandingPatch {
  avatar?: string | null;
  cover?: string | null;
}

export interface BrandingConfig<T> {
  avatar: string | null | undefined;
  cover: string | null | undefined;
  /**
   * Сохранить и вернуть обновлённую сущность. Внутри — свой адрес API и своё
   * имя поля обложки: `cover_media_uuid` у сообщества, `banner_media_uuid`
   * у канала. Демо-режим тоже здесь: он возвращает сущность как есть.
   */
  save: (patch: BrandingPatch) => Promise<T>;
  /** Где у сущности лежат эти два адреса после сохранения. */
  read: (entity: T) => BrandingPatch;
  onUpdated: (entity: T) => void;
  /** Основа имени файла: `community-avatar`, `channel-banner`. */
  fileStem: string;
  labels: BrandingLabels;
}

export interface BrandingState {
  avatarUrl: string;
  coverUrl: string;
  brokenAvatar: boolean;
  brokenCover: boolean;
  markAvatarBroken: () => void;
  markCoverBroken: () => void;
  avatarUploading: boolean;
  coverUploading: boolean;
  avatarInputRef: React.RefObject<HTMLInputElement | null>;
  coverInputRef: React.RefObject<HTMLInputElement | null>;
  pickAvatar: () => void;
  pickCover: () => void;
  onAvatarFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onCoverFile: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pendingAvatar: File | null;
  pendingCover: File | null;
  cancelAvatar: () => void;
  cancelCover: () => void;
  uploadAvatar: (blob: Blob) => Promise<void>;
  uploadCover: (blob: Blob) => Promise<void>;
  removeAvatar: () => Promise<void>;
  removeCover: () => Promise<void>;
}

/**
 * Загрузка аватара и обложки: выбор файла, кадрирование, отправка, удаление.
 *
 * Один и тот же полуторастастрочный кусок жил в четырёх файлах — в шапке и в
 * форме настроек, отдельно у сообщества и отдельно у канала. Отличались имена
 * полей (`coverImage` против `bannerImage`), адрес сохранения и тексты.
 * Всё это здесь параметры: `save`, `read`, `labels`. Флага «это канал» нет —
 * как только он понадобится, значит, сущности снова разошлись, и делить их
 * надо обратно.
 *
 * Внешний вид хук не задаёт вовсе: размеры, скругления и заглушки на месте
 * пустого аватара у сообщества и канала разные, и сводить их в одну картинку
 * никто не просил.
 */
export function useEntityBranding<T>(config: BrandingConfig<T>): BrandingState {
  const { avatar, cover, save, read, onUpdated, fileStem, labels } = config;

  const [avatarUrl, setAvatarUrl] = useState(avatar ?? "");
  const [coverUrl, setCoverUrl] = useState(cover ?? "");
  const [brokenAvatar, setBrokenAvatar] = useState(false);
  const [brokenCover, setBrokenCover] = useState(false);
  const [avatarUploading, setAvatarUploading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingCover, setPendingCover] = useState<File | null>(null);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setAvatarUrl(avatar ?? "");
    setCoverUrl(cover ?? "");
    setBrokenAvatar(false);
    setBrokenCover(false);
  }, [avatar, cover]);

  const pickFile = async (
    e: React.ChangeEvent<HTMLInputElement>,
    maxBytes: number | undefined,
    setPending: (file: File) => void,
  ) => {
    const file = e.target.files?.[0];
    // Сбрасываем до обработки: иначе повторный выбор того же файла не даёт
    // события change.
    e.target.value = "";
    if (!file) return;
    try {
      setPending(await prepareProfileImageFile(file, maxBytes));
    } catch (err) {
      toast.error(err instanceof Error ? err.message : labels.fileProcessFailed);
    }
  };

  const apply = async (patch: BrandingPatch, uploadedUrl: string | null) => {
    const updated = await save(patch);
    const next = read(updated);
    if (patch.avatar !== undefined) {
      setAvatarUrl(patch.avatar === null ? "" : (next.avatar ?? uploadedUrl ?? ""));
      setBrokenAvatar(false);
    }
    if (patch.cover !== undefined) {
      setCoverUrl(patch.cover === null ? "" : (next.cover ?? uploadedUrl ?? ""));
      setBrokenCover(false);
    }
    onUpdated(updated);
  };

  const run = async (
    setBusy: (busy: boolean) => void,
    clearPending: () => void,
    action: () => Promise<void>,
    failureMessage: string,
    successMessage: string,
  ) => {
    clearPending();
    setBusy(true);
    try {
      await action();
      toast.success(successMessage);
    } catch {
      toast.error(failureMessage);
    } finally {
      setBusy(false);
    }
  };

  return {
    avatarUrl,
    coverUrl,
    brokenAvatar,
    brokenCover,
    markAvatarBroken: () => setBrokenAvatar(true),
    markCoverBroken: () => setBrokenCover(true),
    avatarUploading,
    coverUploading,
    avatarInputRef,
    coverInputRef,
    pickAvatar: () => avatarInputRef.current?.click(),
    pickCover: () => coverInputRef.current?.click(),
    onAvatarFile: (e) => void pickFile(e, undefined, setPendingAvatar),
    onCoverFile: (e) => void pickFile(e, PROFILE_COVER_MAX_BYTES, setPendingCover),
    pendingAvatar,
    pendingCover,
    cancelAvatar: () => setPendingAvatar(null),
    cancelCover: () => setPendingCover(null),

    uploadAvatar: (blob) =>
      run(
        setAvatarUploading,
        () => setPendingAvatar(null),
        async () => {
          const media = await uploadMedia(blobToImageFile(blob, `${fileStem}-avatar`), "avatar");
          await apply({ avatar: media.uuid }, media.url ?? "");
        },
        labels.avatarUploadFailed,
        labels.avatarUpdated,
      ),

    removeAvatar: () =>
      run(
        setAvatarUploading,
        () => setPendingAvatar(null),
        () => apply({ avatar: null }, null),
        labels.avatarRemoveFailed,
        labels.avatarRemoved,
      ),

    uploadCover: (blob) =>
      run(
        setCoverUploading,
        () => setPendingCover(null),
        async () => {
          const media = await uploadMedia(blobToImageFile(blob, `${fileStem}-cover`), "banner");
          await apply({ cover: media.uuid }, media.url ?? "");
        },
        labels.coverUploadFailed,
        labels.coverUpdated,
      ),

    removeCover: () =>
      run(
        setCoverUploading,
        () => setPendingCover(null),
        () => apply({ cover: null }, null),
        labels.coverRemoveFailed,
        labels.coverRemoved,
      ),
  };
}
