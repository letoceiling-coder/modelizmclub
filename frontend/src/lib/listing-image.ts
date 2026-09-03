import { isHeicFile } from "@/lib/chat-attachments";

/** Matches backend MediaUploadService LIMITS['listing'].max_size. */
export const LISTING_IMAGE_MAX_BYTES = 10 * 1024 * 1024;

export const LISTING_IMAGE_ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export const LISTING_HEIC_MESSAGE =
  "Формат HEIC не поддерживается. Загрузите изображение в формате JPG или PNG.";

const SUPPORTED_MIMES = new Set(["image/jpeg", "image/png", "image/webp"]);

function supportedByName(file: File): boolean {
  return /\.(jpe?g|png|webp)$/i.test(file.name);
}

/** Returns a user-facing error or null when the file is allowed. */
export function validateListingImageFile(file: File): string | null {
  if (isHeicFile(file)) return LISTING_HEIC_MESSAGE;

  const mime = file.type.toLowerCase();
  if (mime) {
    if (!mime.startsWith("image/")) {
      return "Выберите изображение в формате JPG или PNG.";
    }
    if (!SUPPORTED_MIMES.has(mime)) {
      const ext = file.name.split(".").pop()?.toUpperCase();
      return ext
        ? `Формат ${ext} не поддерживается. Загрузите изображение в формате JPG или PNG.`
        : "Формат не поддерживается. Загрузите изображение в формате JPG или PNG.";
    }
  } else if (!supportedByName(file)) {
    return "Не удалось определить формат. Загрузите изображение в формате JPG или PNG.";
  }

  if (file.size > LISTING_IMAGE_MAX_BYTES) {
    return "Файл превышает 10 МБ. Выберите изображение меньшего размера.";
  }

  return null;
}

/** Ensures the browser can decode the image before showing a preview tile. */
export function verifyListingImageDecodable(file: File): Promise<string | null> {
  const url = URL.createObjectURL(file);
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(
        "Файл повреждён или не открывается. Загрузите другое изображение в формате JPG или PNG.",
      );
    };
    img.src = url;
  });
}
