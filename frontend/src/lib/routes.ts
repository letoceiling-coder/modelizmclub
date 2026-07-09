// Single source of truth for application routes.
// Always import from here instead of hardcoding paths in components.

export const ROUTES = {
  home: "/",
  feed: "/feed",
  communities: "/communities",
  community: (id: string) => `/communities/${id}` as const,
  ads: "/ads",
  ad: (id: string) => `/ads/${id}` as const,
  adCreate: "/ads/new",
  myAds: "/my-ads",
  favorites: "/favorites",
  messenger: "/messenger",
  messengerChat: (chatId: string) => `/messenger?chat=${chatId}` as const,
  profile: "/profile",
  user: (userId: string) => `/user/${userId}` as const,
  friends: "/friends",
  categories: "/categories",
  category: (id: string) => `/categories/${id}` as const,
  subcategory: (id: string, subId: string) => `/categories/${id}/${subId}` as const,
  subscription: "/subscription",
  help: "/help",
  admin: "/admin",
  channels: "/channels",
  channel: (id: string) => `/channel/${id}` as const,
  notifications: "/notifications",
  reviews: "/reviews",
  review: (id: string) => `/reviews/${id}` as const,
  reviewUpload: "/reviews/upload",
} as const;

// Maps sidebar section ids to URL prefixes that should highlight it.
export const SIDEBAR_ROUTE_MAP: Record<string, string[]> = {
  feed: ["/feed", "/categories"],
  communities: ["/communities"],
  channels: ["/channels", "/channel"],
  // "ad-create" стоит ПЕРЕД "ads": getActiveSection возвращает первое
  // совпадение, поэтому /ads/new матчится как отдельная секция, а не как /ads.
  "ad-create": ["/ads/new"],
  ads: ["/ads"],
  "review-upload": ["/reviews/upload"],
  reviews: ["/reviews"],
  "my-ads": ["/my-ads"],
  favorites: ["/favorites"],
  messenger: ["/messenger"],
  profile: ["/profile", "/user"],
  friends: ["/friends"],
  subscription: ["/subscription"],
  help: ["/help"],
  admin: ["/admin"],
  notifications: ["/notifications"],
};

export function getActiveSection(pathname: string): string | null {
  for (const [section, patterns] of Object.entries(SIDEBAR_ROUTE_MAP)) {
    if (patterns.some((p) => pathname === p || pathname.startsWith(p + "/"))) {
      return section;
    }
  }
  return null;
}
