import { isDemoMode } from "@/lib/demo-mode";
import { firstFieldError } from "@/lib/api/validationErrors";
import { ApiError } from "@/lib/api/client";

export type ChatAttachmentKind = "image" | "video" | "file";

/** Matches backend MediaUploadService LIMITS['chat'].max_size (production). */
export const CHAT_ATTACHMENT_MAX_BYTES = 100 * 1024 * 1024;

/** Client-side cap in demo mode (no real upload). */
export const CHAT_ATTACHMENT_DEMO_MAX_BYTES = 20 * 1024 * 1024;

const SUPPORTED_IMAGE_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

export const HEIC_UNSUPPORTED_MESSAGE =
  "Формат HEIC не поддерживается. Загрузите JPG или PNG.";

export function isHeicFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (
    mime === "image/heic"
    || mime === "image/heif"
    || mime === "image/heic-sequence"
    || mime === "image/heif-sequence"
  ) {
    return true;
  }
  return /\.(heic|heif)$/i.test(file.name);
}

export function unsupportedChatImageMessage(file: File): string | null {
  if (isHeicFile(file)) return null;
  const mime = file.type.toLowerCase();
  if (!mime.startsWith("image/")) return null;
  if (SUPPORTED_IMAGE_MIMES.has(mime)) return null;
  const ext = file.name.split(".").pop()?.toUpperCase();
  return ext
    ? `Формат ${ext} не поддерживается. Загрузите JPG, PNG или WEBP.`
    : "Этот формат изображения не поддерживается. Загрузите JPG, PNG или WEBP.";
}

/** Converts iPhone HEIC/HEIF photos to JPEG before upload. */
export async function prepareChatAttachmentFile(
  file: File,
  kind: ChatAttachmentKind,
): Promise<{ file: File; convertedFromHeic: boolean }> {
  if (kind === "image") {
    const unsupported = unsupportedChatImageMessage(file);
    if (unsupported) throw new Error(unsupported);
  }

  if (kind !== "image" || !isHeicFile(file)) {
    return { file, convertedFromHeic: false };
  }

  try {
    const { default: heic2any } = await import("heic2any");
    const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
    const blob = Array.isArray(result) ? result[0] : result;
    if (!(blob instanceof Blob)) throw new Error("convert failed");
    const jpegName = file.name.replace(/\.(heic|heif)$/i, ".jpg");
    return {
      file: new File([blob], jpegName, { type: "image/jpeg" }),
      convertedFromHeic: true,
    };
  } catch (err) {
    if (err instanceof Error && err.message !== "convert failed" && !err.message.startsWith("Формат")) {
      throw new Error(HEIC_UNSUPPORTED_MESSAGE);
    }
    throw err;
  }
}

export function formatChatAttachmentError(err: unknown): string {
  if (err instanceof ApiError) {
    return firstFieldError(err.errors, err.message || "Не удалось отправить вложение");
  }
  if (err instanceof Error && err.message) return err.message;
  return "Не удалось отправить вложение";
}

export function chatAttachmentMaxBytes(): number {
  return isDemoMode() ? CHAT_ATTACHMENT_DEMO_MAX_BYTES : CHAT_ATTACHMENT_MAX_BYTES;
}

export function formatAttachmentLimit(bytes: number): string {
  const mb = bytes / (1024 * 1024);
  return Number.isInteger(mb) ? `${mb} МБ` : `${Math.round(mb)} МБ`;
}

export function chatAttachmentLimitLabel(): string {
  const max = chatAttachmentMaxBytes();
  const size = formatAttachmentLimit(max);
  return isDemoMode() ? `до ${size} (демо)` : `до ${size}`;
}

export function chatPhotoHintLabel(): string {
  return `JPG, PNG · HEIC → JPG · ${chatAttachmentLimitLabel()}`;
}

export function chatAttachmentTooLargeMessage(file: File): string | null {
  const max = chatAttachmentMaxBytes();
  if (file.size <= max) return null;
  return `Файл «${file.name}» (${formatAttachmentLimit(file.size)}). Максимум — ${formatAttachmentLimit(max)}. Сожмите видео или выберите файл меньшего размера.`;
}

/** Reads image dimensions locally before the optimistic chat bubble is shown. */
export function readImageDimensions(file: File): Promise<{ w: number; h: number } | null> {
  if (!file.type.startsWith("image/")) return Promise.resolve(null);
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(
        img.naturalWidth > 0 && img.naturalHeight > 0
          ? { w: img.naturalWidth, h: img.naturalHeight }
          : null,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
