// Feed write operations mapped to backend API.

import type { Comment, Post } from "@/lib/mock";
import { mapPost } from "./feed";
import { api } from "./client";

interface ApiPost {
  uuid: string;
  title: string;
  body: string;
  status: string;
  author?: { uuid: string; display_name?: string | null; avatar?: { url?: string | null } | null };
  category?: { id: number; name: string; slug: string } | null;
  media?: Array<{ media?: { url?: string | null } | null }>;
  hashtags?: string[];
  stats?: { views: number; reactions: number; comments: number };
  viewer?: { reacted: boolean; bookmarked: boolean };
  published_at?: string | null;
  created_at: string;
}

interface ApiComment {
  uuid: string;
  body: string;
  author?: { uuid: string; display_name?: string | null };
  created_at: string;
}

export async function createPost(input: {
  title: string;
  body: string;
  categoryId: number;
  hashtags?: string[];
  mediaIds?: string[];
}): Promise<Post> {
  const res = await api<{ data: ApiPost }>("/posts", {
    method: "POST",
    json: {
      title: input.title,
      body: input.body,
      category_id: input.categoryId,
      hashtags: input.hashtags ?? [],
      media_ids: input.mediaIds ?? [],
    },
  });
  const published = await api<{ data: ApiPost }>(`/posts/${res.data.uuid}/publish`, { method: "POST" });
  return mapPost(published.data);
}

export async function reactPost(postUuid: string, like: boolean): Promise<void> {
  if (like) {
    await api(`/posts/${postUuid}/react`, { method: "POST", json: {} });
  } else {
    await api(`/posts/${postUuid}/react`, { method: "DELETE" });
  }
}

export async function addPostComment(
  postUuid: string,
  body: string,
  parentUuid?: string,
): Promise<Comment> {
  const res = await api<{ data: ApiComment }>(`/posts/${postUuid}/comments`, {
    method: "POST",
    json: { body, parent_uuid: parentUuid ?? null },
  });
  const c = res.data;
  return {
    id: c.uuid,
    authorId: c.author?.uuid ?? "",
    time: "только что",
    text: c.body,
    likes: 0,
    replies: [],
  };
}
