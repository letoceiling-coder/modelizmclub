/**
 * Query keys for the whole app — one place, one shape: [domain, id?, params?].
 * A mutation invalidates the entity key and the list keys the entity appears
 * in; optimistic counters never invalidate the list they live in.
 */
export const qk = {
  session: ["session"] as const,
  /** Feed list. `category` is a taxonomy id or a category name, `tag` a hashtag. */
  feed: (filter: string, category?: string | null, tag?: string | null) =>
    ["feed", filter, category ?? null, tag ?? null] as const,
  post: (uuid: string) => ["post", uuid] as const,
  comments: (postUuid: string, sort?: string | null) =>
    ["comments", postUuid, sort ?? null] as const,
  listings: (params: Record<string, unknown>) => ["listings", params] as const,
  listing: (uuid: string) => ["listing", uuid] as const,
  favorites: ["favorites"] as const,
  conversations: ["conversations"] as const,
  messages: (conversationUuid: string) => ["messages", conversationUuid] as const,
  notifications: ["notifications"] as const,
  profile: (slug: string) => ["profile", slug] as const,
  community: (id: string) => ["community", id] as const,
  channel: (slug: string) => ["channel", slug] as const,
};

export type FeedQueryKey = ReturnType<typeof qk.feed>;

/** How long a cached list stays fresh before a background refetch. */
export const STALE = {
  session: 5 * 60_000,
  feed: 30_000,
  post: 60_000,
  comments: 15_000,
  listings: 60_000,
  listing: 2 * 60_000,
  favorites: 5 * 60_000,
  conversations: 30_000,
  messages: 0,
  notifications: 60_000,
  profile: 2 * 60_000,
  community: 2 * 60_000,
  channel: 2 * 60_000,
} as const;

/**
 * On the server each request builds its own client and drops it after
 * dehydration, but every query still arms a gc timer for its gcTime, and an
 * armed timer keeps the Node event loop open. A 30-minute gcTime therefore kept
 * the process alive for half an hour after SIGTERM until systemd killed it in
 * the middle of a deploy. Long retention only pays off in the browser, so the
 * server caps it at a few seconds.
 */
const SSR = typeof window === "undefined";
const gc = (ms: number): number => (SSR ? Math.min(ms, 1_000) : ms);

/** How long an unused cache entry survives. Feed/post live long enough that
 *  opening a post and pressing Back restores the feed (counters and scroll). */
export const GC = {
  short: gc(5 * 60_000),
  medium: gc(10 * 60_000),
  long: gc(15 * 60_000),
  forever: gc(Infinity),
  feed: gc(30 * 60_000),
  post: gc(30 * 60_000),
  comments: gc(10 * 60_000),
} as const;
