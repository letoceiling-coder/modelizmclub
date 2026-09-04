/**
 * The one place feed query keys and cache timings are declared. Anything that
 * reads or writes the TanStack Query cache for feed data imports from here, so
 * a key never drifts between the hook that fills it and the code that patches it.
 */

/** How long a cached list stays fresh before a background refetch. */
export const STALE = {
  feed: 30_000,
  post: 60_000,
  comments: 15_000,
} as const;

/** How long an unused cache entry survives — long enough that opening a post
 *  and pressing Back restores the feed (counters and scroll) from cache. */
export const GC = {
  feed: 30 * 60_000,
  post: 30 * 60_000,
  comments: 10 * 60_000,
} as const;

export const qk = {
  /** Feed list. `category` is a taxonomy id or a category name, `tag` a hashtag. */
  feed: (filter: string, category?: string | null, tag?: string | null) =>
    ["feed", filter, category ?? null, tag ?? null] as const,
  post: (id: string) => ["post", id] as const,
  comments: (postId: string, sort?: string | null) => ["comments", postId, sort ?? null] as const,
} as const;

export type FeedQueryKey = ReturnType<typeof qk.feed>;
