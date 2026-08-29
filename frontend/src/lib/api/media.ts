import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";

export type MediaPurpose = "avatar" | "cover" | "post" | "post_video" | "review_video" | "listing" | "chat" | "icon" | "banner" | "logo" | "dispute";

export interface UploadedMedia {
  uuid: string;
  url: string | null;
  mime_type?: string;
  width?: number | null;
  height?: number | null;
  status?: string;
}

const PRESIGNED_THRESHOLD = 10 * 1024 * 1024; // 10 MB — above this use direct-to-S3 session

/** Browser PUT to S3 requires bucket CORS; feed/review videos go through the API instead. */
function usePresignedUpload(file: File, purpose: MediaPurpose): boolean {
  if (purpose === "post_video" || purpose === "review_video") return false;
  return file.size > PRESIGNED_THRESHOLD;
}

const REVIEW_VIDEO_MAX = 209_715_200;
const REVIEW_VIDEO_MIMES = new Set(["video/mp4", "video/webm", "video/quicktime"]);

export function validateReviewVideoFile(file: File): string | null {
  if (file.size > REVIEW_VIDEO_MAX) return "Файл превышает 200 МБ";
  if (file.type && !REVIEW_VIDEO_MIMES.has(file.type)) return "Допустимы MP4, WebM или MOV";
  return null;
}

const POST_VIDEO_MAX = 104_857_600;
const POST_VIDEO_MIMES = new Set(["video/mp4", "video/webm"]);

export function validatePostVideoFile(file: File): string | null {
  if (file.size > POST_VIDEO_MAX) return "Видео превышает 100 МБ";
  if (file.type && !POST_VIDEO_MIMES.has(file.type)) {
    return "Для поста допустимы только MP4 или WebM";
  }
  return null;
}

export function postVideoHintLabel(): string {
  return "MP4 или WebM · до 100 МБ";
}

async function uploadViaPresigned(file: File, purpose: MediaPurpose): Promise<UploadedMedia> {
  const mime = file.type || "application/octet-stream";
  const session = await api<{
    data: {
      session_uuid: string;
      uploads: Array<{ media_uuid: string; upload_url: string; headers: Record<string, string> }>;
    };
  }>("/media/upload-session", {
    method: "POST",
    json: {
      purpose,
      files: [{ name: file.name, size: file.size, mime }],
    },
  });

  const slot = session.data.uploads[0];
  if (!slot?.upload_url) throw new Error("Upload session failed");

  const putRes = await fetch(slot.upload_url, {
    method: "PUT",
    headers: { "Content-Type": mime, ...(slot.headers ?? {}) },
    body: file,
  });
  if (!putRes.ok) throw new Error(`Storage upload failed (${putRes.status})`);

  const confirmed = await api<{ data: UploadedMedia[] }>("/media/confirm", {
    method: "POST",
    json: { session_uuid: session.data.session_uuid, media_uuids: [slot.media_uuid] },
  });

  const item = confirmed.data?.[0];
  if (!item?.uuid) throw new Error("Upload confirm failed");
  return item;
}

export async function uploadMedia(file: File, purpose: MediaPurpose): Promise<UploadedMedia> {
  if (isDemoMode()) {
    const url = URL.createObjectURL(file);
    return { uuid: url, url };
  }

  if (usePresignedUpload(file, purpose)) {
    return uploadViaPresigned(file, purpose);
  }

  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);
  const res = await api<{ data: UploadedMedia }>("/media", {
    method: "POST",
    body: form,
  });
  return res.data;
}
