import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";

export type MediaPurpose = "avatar" | "post" | "post_video" | "review_video" | "listing" | "chat";

export interface UploadedMedia {
  uuid: string;
  url: string | null;
  mime_type?: string;
  width?: number | null;
  height?: number | null;
  status?: string;
}

export async function uploadMedia(file: File, purpose: MediaPurpose): Promise<UploadedMedia> {
  if (isDemoMode()) {
    const url = URL.createObjectURL(file);
    return { uuid: url, url };
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
