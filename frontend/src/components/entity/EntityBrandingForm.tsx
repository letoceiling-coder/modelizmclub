import type { ReactNode } from "react";
import { Camera } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Img } from "@/components/ui/Img";
import { PROFILE_IMAGE_ACCEPT, type BrandingState } from "@/components/entity/useEntityBranding";

export interface BrandingFormLabels {
  avatarLabel: string;
  avatarButton: string;
  avatarHint: string;
  coverLabel: string;
  coverButton: string;
  coverHint: string;
  uploading: string;
}

interface Props {
  branding: BrandingState;
  labels: BrandingFormLabels;
  /** Чем занять место аватара, пока его нет: иконка направления или инициалы. */
  avatarFallback: ReactNode;
  /** То же для обложки. */
  coverFallback: ReactNode;
  /** Подложка под пустой обложкой: градиент у сообщества, свой цвет у канала. */
  coverBackground: string;
}

/**
 * Оформление в настройках: строка аватара и строка обложки.
 *
 * Разметка у сообщества и канала совпадала целиком — вплоть до `h-24` у
 * превью обложки и `rounded-[10px] gap-1.5` у кнопок. Расходилось то, чем
 * занято пустое место, и подписи. Обе разницы — параметры.
 */
export function EntityBrandingForm({
  branding,
  labels,
  avatarFallback,
  coverFallback,
  coverBackground,
}: Props) {
  const showAvatar = Boolean(branding.avatarUrl) && !branding.brokenAvatar;
  const showCover = Boolean(branding.coverUrl) && !branding.brokenCover;

  return (
    <div className="space-y-4">
      <div>
        <div className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
          {labels.avatarLabel}
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
              <Img
                src={branding.avatarUrl}
                width={96}
                height={96}
                alt=""
                className="h-full w-full object-cover"
                onError={branding.markAvatarBroken}
              />
            ) : (
              avatarFallback
            )}
          </div>
          <div className="min-w-0">
            <input
              ref={branding.avatarInputRef}
              type="file"
              accept={PROFILE_IMAGE_ACCEPT}
              className="hidden"
              onChange={branding.onAvatarFile}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="rounded-[10px] gap-1.5"
              disabled={branding.avatarUploading}
              onClick={branding.pickAvatar}
            >
              <Camera size={14} />{" "}
              {branding.avatarUploading ? labels.uploading : labels.avatarButton}
            </Button>
            <p className="mt-1 text-[11px]" style={{ color: "var(--foreground-50)" }}>
              {labels.avatarHint}
            </p>
          </div>
        </div>
      </div>

      <div>
        <div className="text-[13px] font-medium" style={{ color: "var(--foreground-70)" }}>
          {labels.coverLabel}
        </div>
        <div
          className="mt-2 overflow-hidden rounded-[10px]"
          style={{
            background: showCover ? "transparent" : coverBackground,
            border: "1px solid var(--border)",
          }}
        >
          {showCover ? (
            <Img
              src={branding.coverUrl}
              width={1200}
              height={300}
              alt=""
              className="h-24 w-full object-cover"
              onError={branding.markCoverBroken}
            />
          ) : (
            coverFallback
          )}
        </div>
        <div className="mt-2">
          <input
            ref={branding.coverInputRef}
            type="file"
            accept={PROFILE_IMAGE_ACCEPT}
            className="hidden"
            onChange={branding.onCoverFile}
          />
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="rounded-[10px] gap-1.5"
            disabled={branding.coverUploading}
            onClick={branding.pickCover}
          >
            <Camera size={14} /> {branding.coverUploading ? labels.uploading : labels.coverButton}
          </Button>
          <p className="mt-1 text-[11px]" style={{ color: "var(--foreground-50)" }}>
            {labels.coverHint}
          </p>
        </div>
      </div>
    </div>
  );
}
