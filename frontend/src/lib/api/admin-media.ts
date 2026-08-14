import { api } from "./client";
import type { MediaPurpose } from "./media";

export type AdminMediaPurpose = Extract<MediaPurpose, "icon" | "banner" | "cover" | "post" | "listing" | "avatar" | "logo">;

export interface AdminMediaItem {
  uuid: string;
  filename: string;
  mimeType: string;
  url: string | null;
  width?: number | null;
  height?: number | null;
  sizeBytes?: number;
  purpose: string;
  createdAt?: string;
}

export interface AdminMediaPage {
  items: AdminMediaItem[];
  currentPage: number;
  lastPage: number;
  perPage: number;
  total: number;
}

const PURPOSE_LABELS: Record<AdminMediaPurpose, string> = {
  icon: "Иконки",
  banner: "Баннеры",
  cover: "Обложки",
  post: "Посты",
  listing: "Объявления",
  avatar: "Аватары",
  logo: "Логотип",
};

export function adminMediaPurposeLabel(purpose: string): string {
  return PURPOSE_LABELS[purpose as AdminMediaPurpose] ?? purpose;
}

export async function fetchAdminMedia(opts?: {
  purpose?: AdminMediaPurpose | "";
  mime?: "image" | "svg" | "png" | "jpeg" | "webp" | "";
  page?: number;
  perPage?: number;
}): Promise<AdminMediaPage> {
  const params = new URLSearchParams();
  if (opts?.purpose) params.set("purpose", opts.purpose);
  if (opts?.mime) params.set("mime", opts.mime);
  if (opts?.page) params.set("page", String(opts.page));
  if (opts?.perPage) params.set("per_page", String(opts.perPage));

  const q = params.toString();
  const res = await api<{
    data: AdminMediaItem[];
    meta: { current_page: number; last_page: number; per_page: number; total: number };
  }>(`/admin/media${q ? `?${q}` : ""}`);

  return {
    items: res.data ?? [],
    currentPage: res.meta?.current_page ?? 1,
    lastPage: res.meta?.last_page ?? 1,
    perPage: res.meta?.per_page ?? 48,
    total: res.meta?.total ?? 0,
  };
}

export async function uploadAdminMedia(file: File, purpose: AdminMediaPurpose): Promise<AdminMediaItem> {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);
  const res = await api<{ data: AdminMediaItem }>("/admin/media", { method: "POST", body: form });
  return res.data;
}

export interface BatchUploadResult {
  uploaded: AdminMediaItem[];
  failed: { filename: string; error: string }[];
}

/** Upload multiple files sequentially (one POST per file). */
export async function uploadAdminMediaMany(
  files: File[],
  purpose: AdminMediaPurpose,
): Promise<BatchUploadResult> {
  const uploaded: AdminMediaItem[] = [];
  const failed: { filename: string; error: string }[] = [];

  for (const file of files) {
    try {
      uploaded.push(await uploadAdminMedia(file, purpose));
    } catch (e) {
      failed.push({
        filename: file.name,
        error: e instanceof Error ? e.message : "Не удалось загрузить",
      });
    }
  }

  return { uploaded, failed };
}

export function adminMediaAccept(purpose: AdminMediaPurpose): string {
  if (purpose === "icon") return "image/png,image/svg+xml,.png,.svg";
  return "image/jpeg,image/png,image/webp,image/svg+xml,.jpg,.jpeg,.png,.webp,.svg";
}
