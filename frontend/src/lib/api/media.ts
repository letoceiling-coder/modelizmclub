import { api, API_BASE_URL, ApiError, getLocale, getToken } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import type { MediaVariantSet } from "@/lib/media/variants";

export type MediaPurpose = "avatar" | "cover" | "post" | "post_video" | "review_video" | "listing" | "chat" | "icon" | "banner" | "logo" | "dispute";
export type UploadProgress = (pct: number) => void;

export interface UploadedMedia {
  uuid: string;
  url: string | null;
  mime_type?: string;
  width?: number | null;
  height?: number | null;
  status?: string;
  variants?: MediaVariantSet;
}

const PRESIGNED_THRESHOLD = 10 * 1024 * 1024; // 10 MB — above this use direct-to-S3 session

function usePresignedUpload(file: File, purpose: MediaPurpose): boolean {
  if (purpose === "post_video" || purpose === "review_video") return true;
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

function xhrSend(
  method: string,
  url: string,
  body: XMLHttpRequestBodyInit | null,
  headers: Record<string, string>,
  onProgress?: UploadProgress,
  progressFrom = 0,
  progressTo = 100,
): Promise<XMLHttpRequest> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    for (const [key, value] of Object.entries(headers)) {
      if (value) xhr.setRequestHeader(key, value);
    }
    xhr.upload.onprogress = (event) => {
      if (!onProgress || !event.lengthComputable || event.total <= 0) return;
      const ratio = event.loaded / event.total;
      onProgress(Math.round(progressFrom + ratio * (progressTo - progressFrom)));
    };
    xhr.onload = () => resolve(xhr);
    xhr.onerror = () => reject(new Error("Network error"));
    xhr.send(body);
  });
}

function parseJsonPayload(text: string): unknown {
  if (!text) return null;
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}

function throwIfXhrFailed(xhr: XMLHttpRequest): void {
  if (xhr.status >= 200 && xhr.status < 300) return;
  const data = parseJsonPayload(xhr.responseText);
  const obj = (data ?? {}) as { message?: string; errors?: Record<string, string[]> };
  throw new ApiError(xhr.status, obj.message || `HTTP ${xhr.status}`, obj.errors, data);
}

async function uploadViaPresigned(
  file: File,
  purpose: MediaPurpose,
  onProgress?: UploadProgress,
): Promise<UploadedMedia> {
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
  onProgress?.(5);

  const putRes = await xhrSend(
    "PUT",
    slot.upload_url,
    file,
    { "Content-Type": mime, ...(slot.headers ?? {}) },
    onProgress,
    5,
    92,
  );
  if (putRes.status < 200 || putRes.status >= 300) {
    throw new Error(`Storage upload failed (${putRes.status})`);
  }
  onProgress?.(95);

  const confirmed = await api<{ data: UploadedMedia[] }>("/media/confirm", {
    method: "POST",
    json: { session_uuid: session.data.session_uuid, media_uuids: [slot.media_uuid] },
  });

  const item = confirmed.data?.[0];
  if (!item?.uuid) throw new Error("Upload confirm failed");
  onProgress?.(100);
  return item;
}

async function uploadViaApi(
  file: File,
  purpose: MediaPurpose,
  onProgress?: UploadProgress,
): Promise<UploadedMedia> {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);

  if (!onProgress || typeof XMLHttpRequest === "undefined") {
    const res = await api<{ data: UploadedMedia }>("/media", {
      method: "POST",
      body: form,
    });
    onProgress?.(100);
    return res.data;
  }

  const headers: Record<string, string> = {
    Accept: "application/json",
    "Accept-Language": getLocale(),
  };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const xhr = await xhrSend("POST", `${API_BASE_URL}/media`, form, headers, onProgress);
  throwIfXhrFailed(xhr);
  const payload = parseJsonPayload(xhr.responseText) as { data?: UploadedMedia } | null;
  if (!payload?.data?.uuid) throw new Error("Upload failed");
  onProgress(100);
  return payload.data;
}

function isPresignPutFailure(error: unknown): boolean {
  if (error instanceof ApiError) return false;
  return true;
}

export async function uploadMedia(
  file: File,
  purpose: MediaPurpose,
  onProgress?: UploadProgress,
): Promise<UploadedMedia> {
  if (isDemoMode()) {
    const url = URL.createObjectURL(file);
    onProgress?.(100);
    return { uuid: url, url };
  }

  if (usePresignedUpload(file, purpose)) {
    try {
      return await uploadViaPresigned(file, purpose, onProgress);
    } catch (error) {
      if (!isPresignPutFailure(error)) throw error;
      return uploadViaApi(file, purpose, onProgress);
    }
  }

  return uploadViaApi(file, purpose, onProgress);
}

const inflightUploads = new WeakMap<File, Promise<UploadedMedia>>();

/** Same File object shares one in-flight request (pick + submit race). */
export function uploadMediaDeduped(
  file: File,
  purpose: MediaPurpose,
  onProgress?: UploadProgress,
): Promise<UploadedMedia> {
  const existing = inflightUploads.get(file);
  if (existing) return existing;
  const pending = uploadMedia(file, purpose, onProgress).finally(() => inflightUploads.delete(file));
  inflightUploads.set(file, pending);
  return pending;
}
