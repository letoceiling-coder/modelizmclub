import type { InfiniteData } from "@tanstack/react-query";
import type { FeedResult } from "@/lib/api/feed";
import type { Post } from "@/lib/mock";

/**
 * Pure cache updaters for the feed's `useInfiniteQuery` data. They live apart
 * from the components so an optimistic update and its rollback are one
 * testable function each: every updater is idempotent — applying it twice with
 * the same target state changes nothing, and applying the previous state undoes
 * it exactly. That is what makes the rollback in `onError` safe.
 */
export type FeedPages = InfiniteData<FeedResult, number>;

/** Replaces the posts of every page through `fn`, keeping page metadata. */
export function mapFeedPosts(
  data: FeedPages | undefined,
  fn: (post: Post) => Post,
): FeedPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, posts: page.posts.map(fn) })),
  };
}

/** Shallow-merges `patch` into the post with this id, wherever it sits. */
export function patchFeedPost(
  data: FeedPages | undefined,
  id: string,
  patch: Partial<Post>,
): FeedPages | undefined {
  return mapFeedPosts(data, (p) => (p.id === id ? { ...p, ...patch } : p));
}

export function removeFeedPost(data: FeedPages | undefined, id: string): FeedPages | undefined {
  if (!data) return data;
  return {
    ...data,
    pages: data.pages.map((page) => ({ ...page, posts: page.posts.filter((p) => p.id !== id) })),
  };
}

/** Puts a freshly created post at the top of the first page. */
export function prependFeedPost(data: FeedPages | undefined, post: Post): FeedPages | undefined {
  if (!data || data.pages.length === 0) {
    return {
      pages: [{ posts: [post], page: 1, lastPage: 1, total: 1 }],
      pageParams: [1],
    };
  }
  const [first, ...rest] = data.pages;
  return {
    ...data,
    pages: [{ ...first, posts: [post, ...first.posts.filter((p) => p.id !== post.id)] }, ...rest],
  };
}

/** Reaction flag + counter, moved together so the number can never drift. */
export function setPostLiked(post: Post, liked: boolean): Post {
  if (Boolean(post.isLiked) === liked) return post;
  return { ...post, isLiked: liked, likes: Math.max(0, (post.likes ?? 0) + (liked ? 1 : -1)) };
}

export function setPostSaved(post: Post, saved: boolean): Post {
  if (Boolean(post.isSaved) === saved) return post;
  return { ...post, isSaved: saved, saves: Math.max(0, (post.saves ?? 0) + (saved ? 1 : -1)) };
}

export function setPostReposted(post: Post, reposted: boolean): Post {
  if (Boolean(post.isReposted) === reposted) return post;
  return {
    ...post,
    isReposted: reposted,
    reposts: Math.max(0, (post.reposts ?? 0) + (reposted ? 1 : -1)),
  };
}

/** Optimistic like across the cached feed; pass the previous value to roll back. */
export function toggleFeedLike(
  data: FeedPages | undefined,
  id: string,
  liked: boolean,
): FeedPages | undefined {
  return mapFeedPosts(data, (p) => (p.id === id ? setPostLiked(p, liked) : p));
}

export function toggleFeedSave(
  data: FeedPages | undefined,
  id: string,
  saved: boolean,
): FeedPages | undefined {
  return mapFeedPosts(data, (p) => (p.id === id ? setPostSaved(p, saved) : p));
}

export function toggleFeedRepost(
  data: FeedPages | undefined,
  id: string,
  reposted: boolean,
): FeedPages | undefined {
  return mapFeedPosts(data, (p) => (p.id === id ? setPostReposted(p, reposted) : p));
}

/** Comment counter after a comment is added or removed (never negative). */
export function bumpFeedComments(
  data: FeedPages | undefined,
  id: string,
  delta: number,
): FeedPages | undefined {
  return mapFeedPosts(data, (p) =>
    p.id === id ? { ...p, comments: Math.max(0, (p.comments ?? 0) + delta) } : p,
  );
}

/** Flattens the pages into the list the feed renders. */
export function feedPostsOf(data: FeedPages | undefined): Post[] {
  return data?.pages.flatMap((page) => page.posts) ?? [];
}
