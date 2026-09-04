import { HEIC_UNSUPPORTED_MESSAGE, isHeicFile } from "@/lib/chat-attachments";

export const PROFILE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const PROFILE_COVER_MAX_BYTES = 10 * 1024 * 1024;
export const PROFILE_IMAGE_ACCEPT =
  "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif";

const SUPPORTED = new Set(["image/jpeg", "image/png", "image/webp"]);

export function unsupportedProfileImageMessage(file: File): string | null {
  if (isHeicFile(file)) return null;
  const mime = file.type.toLowerCase();
  if (!mime) {
    if (/\.(jpe?g|png|webp)$/i.test(file.name)) return null;
    return "Не удалось определить формат. Загрузите JPG, PNG или WEBP.";
  }
  if (!mime.startsWith("image/")) return "Выберите изображение: JPG, PNG или WEBP.";
  if (SUPPORTED.has(mime)) return null;
  const ext = file.name.split(".").pop()?.toUpperCase();
  return ext
    ? `Формат ${ext} не поддерживается. Загрузите JPG, PNG или WEBP.`
    : "Формат не поддерживается. Загрузите JPG, PNG или WEBP.";
}

async function decodeImageFile(file: File): Promise<void> {
  const url = URL.createObjectURL(file);
  try {
    await new Promise<void>((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("Файл повреждён или не открывается в браузере."));
      img.src = url;
    });
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Validates size/format, converts HEIC → JPEG, verifies the browser can decode it. */
export async function prepareProfileImageFile(
  file: File,
  maxBytes: number = PROFILE_IMAGE_MAX_BYTES,
): Promise<File> {
  if (file.size > maxBytes) {
    const mb = Math.round(maxBytes / (1024 * 1024));
    throw new Error(`Файл слишком большой. Максимум ${mb} МБ.`);
  }

  const unsupported = unsupportedProfileImageMessage(file);
  if (unsupported) throw new Error(unsupported);

  let prepared = file;
  if (isHeicFile(file)) {
    try {
      const { default: heic2any } = await import("heic2any");
      const result = await heic2any({ blob: file, toType: "image/jpeg", quality: 0.92 });
      const blob = Array.isArray(result) ? result[0] : result;
      if (!(blob instanceof Blob)) throw new Error("convert failed");
      prepared = new File([blob], file.name.replace(/\.(heic|heif)$/i, ".jpg"), {
        type: "image/jpeg",
      });
    } catch (err) {
      if (err instanceof Error && err.message.startsWith("Формат")) throw err;
      throw new Error(HEIC_UNSUPPORTED_MESSAGE);
    }
  }

  await decodeImageFile(prepared);
  return prepared;
}

/** Preserve blob MIME when wrapping for upload (avoid PNG labeled as JPEG). */
export function blobToImageFile(blob: Blob, baseName: string): File {
  const type = blob.type === "image/png" ? "image/png" : "image/jpeg";
  const ext = type === "image/png" ? "png" : "jpg";
  return new File([blob], `${baseName}.${ext}`, { type });
}
