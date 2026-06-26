import { API_BASE_URL } from "./config";
import { getAuthToken } from "./auth";
import { ApiError } from "./client";

export type UploadedMedia = {
  uuid: string;
  url: string | null;
  mime_type: string;
  width: number | null;
  height: number | null;
  status: string;
};

export type MediaPurpose = "avatar" | "post" | "post_video" | "listing" | "chat";

/** Uploads a single file directly to the backend and returns the ready media. */
export async function uploadMedia(file: File, purpose: MediaPurpose): Promise<UploadedMedia> {
  const token = getAuthToken();
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);

  const url = `${API_BASE_URL.replace(/\/$/, "")}/media`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: form,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message =
      data && typeof data === "object" && "message" in data
        ? String((data as { message: string }).message)
        : `HTTP ${res.status}`;
    throw new ApiError(message, res.status, data);
  }

  return (data as { data: UploadedMedia }).data;
}

/** Uploads many files sequentially, returning ready media in order. */
export async function uploadMediaBatch(files: File[], purpose: MediaPurpose): Promise<UploadedMedia[]> {
  const out: UploadedMedia[] = [];
  for (const file of files) {
    out.push(await uploadMedia(file, purpose));
  }
  return out;
}
