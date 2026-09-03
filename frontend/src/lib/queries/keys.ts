/**
 * Query keys for the whole app — one place, one shape: [domain, id?, params?].
 * A mutation invalidates the entity key and the list keys the entity appears
 * in; optimistic counters never invalidate the list they live in.
 */
export const qk = {
  session: ["session"] as const,
  feed: (filter: string, category: string | null) => ["feed", filter, category] as const,
  post: (uuid: string) => ["post", uuid] as const,
  comments: (postUuid: string, sort: string) => ["comments", postUuid, sort] as const,
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

export const STALE = {
  session: 5 * 60_000,
  feed: 30_000,
  post: 60_000,
  comments: 30_000,
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

export const GC = {
  short: 5 * 60_000,
  medium: 10 * 60_000,
  long: 15 * 60_000,
  forever: Infinity,
} as const;
