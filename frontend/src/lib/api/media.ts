import { api } from "./client";

export type MediaPurpose = "avatar" | "post" | "post_video" | "listing" | "chat";

export interface UploadedMedia {
  uuid: string;
  url: string | null;
  mime_type?: string;
  width?: number | null;
  height?: number | null;
  status?: string;
}

export async function uploadMedia(file: File, purpose: MediaPurpose): Promise<UploadedMedia> {
  const form = new FormData();
  form.append("file", file);
  form.append("purpose", purpose);
  const res = await api<{ data: UploadedMedia }>("/media", {
    method: "POST",
    body: form,
  });
  return res.data;
}
