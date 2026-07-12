import type { Video, VideoCategory, Comment } from "@/lib/mock";
import { api } from "./client";
import { isDemoMode } from "@/lib/demo-mode";
import { mapComment, type ApiComment } from "./feed";
import {
  demoVideos,
  demoVideo,
  demoVideoCategories,
  demoFeaturedVideos,
  demoIncrementVideoView,
  demoVideoComments,
  demoAddVideo,
  demoDeleteVideo,
  demoSetVideoFeatured,
} from "@/lib/demo-data";

interface Paginated<T> {
  data: T[];
  meta?: { current_page?: number; last_page?: number; total?: number };
}

// Real-branch adapter shape — documented in backend-endpoints-needed.md (Task 10).
interface ApiVideo {
  uuid: string;
  title: string;
  description?: string | null;
  category?: { id?: string; slug?: string } | null;
  poster_url?: string | null;
  video_url?: string | null;
  duration_seconds?: number;
  views_count?: number;
  is_featured?: boolean;
  tags?: string[];
  published_at?: string;
  uploader?: { uuid?: string } | null;
  status?: "processing" | "published";
  likes_count?: number;
  comments_count?: number;
  is_liked?: boolean;
}

function mapVideo(v: ApiVideo): Video {
  return {
    id: v.uuid,
    title: v.title,
    description: v.description ?? "",
    categoryId: v.category?.id ?? "",
    posterUrl: v.poster_url ?? "",
    videoUrl: v.video_url ?? "",
    durationSeconds: v.duration_seconds ?? 0,
    views: v.views_count ?? 0,
    isFeatured: v.is_featured ?? false,
    tags: v.tags ?? [],
    publishedAt: v.published_at ?? "",
    uploaderId: v.uploader?.uuid ?? "",
    status: v.status ?? "published",
    likes: v.likes_count ?? 0,
    comments: v.comments_count ?? 0,
    isLiked: v.is_liked ?? false,
  };
}

export interface VideoListParams {
  q?: string;
  categorySlug?: string;
  featured?: boolean;
}

export async function fetchVideos(params: VideoListParams = {}): Promise<Video[]> {
  if (isDemoMode()) {
    if (params.featured) return demoFeaturedVideos();
    return demoVideos(params.q, params.categorySlug);
  }
  // "all" is a UI sentinel for the "Все" tab — never send it as a real filter.
  const categorySlug = params.categorySlug && params.categorySlug !== "all" ? params.categorySlug : undefined;
  const res = await api<Paginated<ApiVideo>>("/videos", {
    query: {
      q: params.q || undefined,
      category: categorySlug,
      featured: params.featured ? 1 : undefined,
      sort: "new",
      per_page: 50,
    },
  });
  return (res.data ?? []).map(mapVideo);
}

interface ApiVideoCategory {
  id: string;
  slug: string;
  title?: string;
  name?: string;
  sort_order?: number;
}

function mapVideoCategory(c: ApiVideoCategory): VideoCategory {
  return {
    id: c.id,
    slug: c.slug,
    name: c.name ?? c.title ?? c.slug,
  };
}

export async function fetchVideoCategories(): Promise<VideoCategory[]> {
  if (isDemoMode()) return demoVideoCategories();
  const res = await api<Paginated<ApiVideoCategory>>("/videos/categories");
  return (res.data ?? []).map(mapVideoCategory);
}

export async function fetchVideo(id: string): Promise<Video> {
  if (isDemoMode()) {
    const v = demoVideo(id);
    if (v) return v;
    throw new Error("Video not found");
  }
  const res = await api<{ data: ApiVideo }>(`/videos/${id}`);
  return mapVideo(res.data);
}

export async function incrementVideoView(id: string): Promise<void> {
  if (isDemoMode()) {
    demoIncrementVideoView(id);
    return;
  }
  await api(`/videos/${id}/view`, { method: "POST" });
}

export interface VideoUploadInput {
  title: string;
  description: string;
  categoryId: string;
  tags: string[];
  posterMediaId: string;
  videoMediaId: string;
  posterUrl: string;   // demo: blob URL for immediate preview
  videoUrl: string;    // demo: blob URL for immediate playback
  isFeatured: boolean;
}

export async function uploadVideo(input: VideoUploadInput): Promise<Video> {
  if (isDemoMode()) {
    const now = new Date().toISOString();
    const v: Video = {
      id: `demo-v-${Date.now()}`,
      title: input.title,
      description: input.description,
      categoryId: input.categoryId,
      posterUrl: input.posterUrl,
      videoUrl: input.videoUrl,
      durationSeconds: 0,
      views: 0,
      isFeatured: input.isFeatured,
      tags: input.tags,
      publishedAt: now,
      uploaderId: "u1",
      status: "published",
      likes: 0,
      comments: 0,
      commentList: [],
    };
    demoAddVideo(v);
    return v;
  }
  const res = await api<{ data: ApiVideo }>("/videos", {
    method: "POST",
    json: {
      title: input.title,
      description: input.description,
      category_id: input.categoryId,
      tags: input.tags,
      poster_media_id: input.posterMediaId,
      video_media_id: input.videoMediaId,
      is_featured: input.isFeatured,
    },
  });
  return mapVideo(res.data);
}

// ── Social interactions — exact parity copies of feed.ts (path /posts/ → /videos/) ──

export async function reactToVideo(uuid: string, on: boolean): Promise<void> {
  if (isDemoMode()) return;
  await api(`/videos/${uuid}/react`, { method: on ? "POST" : "DELETE" });
}

export async function fetchVideoComments(uuid: string): Promise<Comment[]> {
  if (isDemoMode()) return demoVideoComments(uuid);
  const res = await api<Paginated<ApiComment>>(`/videos/${uuid}/comments`);
  return (res.data ?? []).map(mapComment);
}

export async function createVideoComment(
  uuid: string,
  body: string,
  parentUuid?: string,
): Promise<Comment> {
  if (isDemoMode()) {
    return {
      id: `demo-vc-${Date.now()}`,
      authorId: "u1",
      time: "только что",
      text: body,
      likes: 0,
      replies: [],
    };
  }
  const res = await api<{ data: ApiComment }>(`/videos/${uuid}/comments`, {
    method: "POST",
    json: { body, parent_uuid: parentUuid },
  });
  return mapComment(res.data);
}

// ── Admin management ──────────────────────────────────────────────────────

export async function deleteVideo(id: string): Promise<void> {
  if (isDemoMode()) { demoDeleteVideo(id); return; }
  await api(`/videos/${id}`, { method: "DELETE" });
}

export async function setVideoFeatured(id: string, on: boolean): Promise<void> {
  if (isDemoMode()) { demoSetVideoFeatured(id, on); return; }
  await api(`/videos/${id}`, { method: "PATCH", json: { is_featured: on } });
}
