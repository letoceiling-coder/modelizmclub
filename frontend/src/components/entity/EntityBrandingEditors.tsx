import { PhotoEditorDialog } from "@/components/media/PhotoEditorDialog";
import type { PhotoEditorDialogProps } from "@/components/media/PhotoEditorDialog";
import type { BrandingState } from "@/components/entity/useEntityBranding";

export interface BrandingEditorConfig {
  title: string;
  /** Круг у сообщества, прямоугольник у канала — не флаг, а решение вызывающего. */
  shape?: PhotoEditorDialogProps["shape"];
  outputMime?: PhotoEditorDialogProps["outputMime"];
}

/**
 * Два окна кадрирования — под аватар и под обложку.
 *
 * Пропорции, размер вывода и подсказки безопасной зоны у сообщества и канала
 * совпадают до последнего числа: 1:1 480×480 и 3.5:1 1400×400. Расходятся
 * заголовок, форма маски и формат вывода — они и вынесены в параметры.
 */
export function EntityBrandingEditors({
  branding,
  avatar,
  cover,
}: {
  branding: BrandingState;
  avatar: BrandingEditorConfig;
  cover: BrandingEditorConfig;
}) {
  return (
    <>
      <PhotoEditorDialog
        file={branding.pendingAvatar}
        aspect={1}
        lockAspect
        shape={avatar.shape ?? "rect"}
        lockShape
        outputWidth={480}
        outputHeight={480}
        outputMime={avatar.outputMime}
        title={avatar.title}
        onCancel={branding.cancelAvatar}
        onCropped={(blob) => void branding.uploadAvatar(blob)}
        onDelete={branding.avatarUrl ? () => void branding.removeAvatar() : undefined}
      />
      <PhotoEditorDialog
        file={branding.pendingCover}
        aspect={3.5}
        lockAspect
        shape={cover.shape ?? "rect"}
        lockShape
        outputWidth={1400}
        outputHeight={400}
        outputMime={cover.outputMime}
        safeZonePreset="cover-wide"
        title={cover.title}
        onCancel={branding.cancelCover}
        onCropped={(blob) => void branding.uploadCover(blob)}
        onDelete={branding.coverUrl ? () => void branding.removeCover() : undefined}
      />
    </>
  );
}
