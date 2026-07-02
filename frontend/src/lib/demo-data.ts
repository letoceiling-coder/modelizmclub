// Demo dataset + store seeding for DEMO MODE.
//
// Reuses the rich fixtures in `mock.ts` and reshapes them into the exact return
// types each API function produces, so demo-mode short-circuits stay one-liners.
// Nothing here runs in production (guarded by isDemoMode at every call site).

import {
  users as mockUsers,
  posts as mockPosts,
  ads as mockAds,
  communities as mockCommunities,
  dialogs as mockDialogs,
  categories as mockCategories,
  banners as mockBanners,
  faqItems,
  faqCategories,
  firstHundredStats,
  registerUser,
  adById,
  communityById,
  type User,
  type Post,
  type Ad,
  type Community,
  type Dialog,
  type Message,
  type Category,
  type Banner,
  type ID,
} from "@/lib/mock";
import {
  setCurrentUser,
  setDialogs,
  actions,
  type AdStatusKey,
} from "@/lib/store";

// ── Demo user ────────────────────────────────────────────────────────────────
// Slots into id "u1" so the whole mock graph (its posts, ads, dialogs where
// authorId === "u1", community adminships) naturally belongs to "me".
export const DEMO_USER: User = {
  id: "u1",
  numericId: 1,
  slug: "rcpilot",
  name: "Алексей Крылов",
  city: "Краснодар",
  interests: "RC авиация, Багги 1:8, Судомоделизм",
  avatar:
    "https://api.dicebear.com/7.x/initials/svg?seed=" +
    encodeURIComponent("Алексей Крылов") +
    "&backgroundColor=627fff,3f4fbf,1976d2",
  subscription: "Год",
  bio: "Пилот RC-авиации и багги 1:8. Строю, летаю, гоняю. Собираю сообщество моделистов Краснодара.",
  status: "Основатель · МоДелизМ Pro",
  coverImage: "https://picsum.photos/seed/modelizm101/1200/400",
  joinedDate: "2024-03-15T10:00:00Z",
  friendIds: ["u2", "u3", "u5", "u6", "u7"],
  online: true,
  isAdmin: true,
  firstHundred: true,
};

// ── boot: register users + seed store ────────────────────────────────────────
let seeded = false;

// Communities the demo user has joined (also reflected in demoCommunities()).
const JOINED_COMMUNITY_IDS = ["g1", "g3", "g7"];

export function seedDemoStore(): void {
  if (seeded || typeof window === "undefined") return;
  seeded = true;

  // Register every mock user into the runtime registry so userById() resolves
  // authors, sellers and chat peers. Demo user overrides the "u1" slot.
  for (const u of mockUsers) registerUser(u);
  registerUser(DEMO_USER);

  // Current session user.
  setCurrentUser(DEMO_USER);

  // Community memberships (store selectors reflect the joined state used by the
  // community pages' join/leave buttons).
  for (const id of JOINED_COMMUNITY_IDS) actions.joinCommunity(DEMO_USER.id, id);

  // Conversations into the store (messenger reads dialogs from the store).
  setDialogs(mockDialogs);
}

// ── auth ─────────────────────────────────────────────────────────────────────
export function demoMe(): User {
  return DEMO_USER;
}

// ── feed ─────────────────────────────────────────────────────────────────────
export interface DemoFeedResult {
  posts: Post[];
  page: number;
  lastPage: number;
  total: number;
}

export function demoFeed(opts?: {
  filter?: string;
  page?: number;
  perPage?: number;
}): DemoFeedResult {
  let list = mockPosts.slice();
  if (opts?.filter === "following") list = list.filter((p) => p.isFollowing);
  const perPage = opts?.perPage ?? 20;
  const page = opts?.page ?? 1;
  const start = (page - 1) * perPage;
  const slice = list.slice(start, start + perPage);
  return {
    posts: slice,
    page,
    lastPage: Math.max(1, Math.ceil(list.length / perPage)),
    total: list.length,
  };
}

export function demoPostComments(uuid: ID) {
  const p = mockPosts.find((x) => x.id === uuid);
  return p?.commentList ?? [];
}

// ── listings / ads ───────────────────────────────────────────────────────────
export function demoListings(query?: string): Ad[] {
  if (!query) return mockAds;
  const q = query.toLowerCase();
  return mockAds.filter(
    (a) =>
      a.title.toLowerCase().includes(q) ||
      (a.description ?? "").toLowerCase().includes(q) ||
      a.category.toLowerCase().includes(q),
  );
}

export function demoMyListings(): { ad: Ad; status: AdStatusKey }[] {
  return mockAds
    .filter((a) => a.authorId === DEMO_USER.id)
    .map((ad) => ({
      ad,
      status: (ad.moderation === "moderation"
        ? "moderation"
        : "active") as AdStatusKey,
    }));
}

export function demoListing(id: ID): Ad | null {
  return adById(id) ?? null;
}

// ── communities ──────────────────────────────────────────────────────────────
// The demo user is a member of g1/g3/g7 — reflect that on the returned data so
// "Мои сообщества" and join buttons are consistent with the seeded store.
const JOINED = new Set(["g1", "g3", "g7"]);

// In-session subscribe overrides (like channels): lets the VK-style community
// page toggle "Подписаться / Вы подписаны" without a backend. Resets on full
// reload (documented demo limitation).
const communitySubOverrides = new Map<string, boolean>();

function isJoined(c: Community): boolean {
  const ov = communitySubOverrides.get(c.id);
  return ov === undefined ? JOINED.has(c.id) : ov;
}
function withJoined(c: Community): Community {
  const joined = isJoined(c);
  const base = JOINED.has(c.id) ? c.members : c.members;
  // reflect the toggle in the member count so the header reads honestly
  const delta = joined && !JOINED.has(c.id) ? 1 : !joined && JOINED.has(c.id) ? -1 : 0;
  return { ...c, joined, members: Math.max(0, base + delta) };
}

/** Toggle a demo community membership for the current session. */
export function setDemoCommunitySubscription(slug: ID, joined: boolean): void {
  const c = communityById(slug) ?? mockCommunities.find((x) => x.id === slug);
  if (!c) return;
  communitySubOverrides.set(c.id, joined);
}

export function demoCommunities(query?: string): Community[] {
  const list = mockCommunities.map(withJoined);
  if (!query) return list;
  const q = query.toLowerCase();
  return list.filter(
    (c) => c.name.toLowerCase().includes(q) || c.description.toLowerCase().includes(q),
  );
}

export function demoCommunity(slug: ID): Community | null {
  const c = communityById(slug) ?? mockCommunities.find((x) => x.name === slug);
  return c ? withJoined(c) : null;
}

// ── community detail content (posts / discussions / events / members) ─────────
// Deterministic-per-community demo content so the VK-style tabs are always
// populated. Reuses the rich mock post/user fixtures; nothing here hits a
// backend (guarded by isDemoMode at the call site).

export interface DemoDiscussion {
  id: string;
  title: string;
  replies: number;
  lastActivity: string;
  authorName: string;
}
export interface DemoCommunityEvent {
  id: string;
  title: string;
  date: string;
  place: string;
  cover: string;
  attendees: number;
}
export interface DemoCommunityMember {
  user: User;
  role: "Администратор" | "Модератор" | "Участник";
}

function seedNum(slug: string): number {
  return slug.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
}
function pmimg(id: number): string {
  return `https://picsum.photos/seed/mzc${id}/1200/800`;
}

/** Posts shown on the community wall. Prefer the community's own postIds; then
 *  top up from the general feed so every community has ≥4 posts. */
export function demoCommunityPosts(slug: ID): Post[] {
  const c = communityById(slug);
  const pinned = (c?.postIds ?? [])
    .map((pid) => mockPosts.find((p) => p.id === pid))
    .filter((p): p is Post => Boolean(p));
  const seed = seedNum(slug);
  const filler = mockPosts
    .filter((p) => !pinned.some((pp) => pp.id === p.id))
    .slice(seed % 5, (seed % 5) + 5);
  return [...pinned, ...filler].slice(0, 6);
}

export function demoCommunityDiscussions(slug: ID): DemoDiscussion[] {
  const seed = seedNum(slug);
  const names = mockUsers.map((u) => u.name);
  const pick = (i: number) => names[(seed + i) % names.length];
  return [
    { id: "d1", title: "Настройка двигателя: делимся сетапами", replies: 24 + (seed % 30), lastActivity: "5 минут назад", authorName: pick(0) },
    { id: "d2", title: "Выбор аппаратуры для новичка", replies: 18 + (seed % 20), lastActivity: "40 минут назад", authorName: pick(1) },
    { id: "d3", title: "Гонки и встречи: календарь сезона", replies: 42 + (seed % 25), lastActivity: "2 часа назад", authorName: pick(2) },
    { id: "d4", title: "Новичкам: с чего начать", replies: 63 + (seed % 15), lastActivity: "вчера", authorName: pick(3) },
  ];
}

export function demoCommunityEvents(slug: ID): DemoCommunityEvent[] {
  const seed = seedNum(slug);
  return [
    { id: "e1", title: "Гонки RC в Краснодаре", date: "12 июля, 11:00", place: "Трасса «Юбилейный», Краснодар", cover: pmimg(seed + 1), attendees: 48 + (seed % 40) },
    { id: "e2", title: "Встреча авиамоделистов", date: "20 июля, 10:00", place: "Полётное поле, Сосновка", cover: pmimg(seed + 2), attendees: 32 + (seed % 30) },
    { id: "e3", title: "Обзорный заезд для новичков", date: "27 июля, 12:00", place: "Клубная площадка", cover: pmimg(seed + 3), attendees: 21 + (seed % 20) },
  ];
}

export function demoCommunityMembers(slug: ID): DemoCommunityMember[] {
  const c = communityById(slug);
  const adminId = c?.adminId;
  const ordered = [
    ...mockUsers.filter((u) => u.id === adminId),
    ...mockUsers.filter((u) => u.id !== adminId),
  ];
  return ordered.map((user, i) => ({
    user,
    role: user.id === adminId ? "Администратор" : i === 1 ? "Модератор" : "Участник",
  }));
}

// ── channels ─────────────────────────────────────────────────────────────────
export interface DemoChannel {
  id: string;
  name: string;
  slug: string;
  description: string;
  category: string;
  kind: "official" | "brand" | "shop" | "author" | "expert";
  avatarColor: string;
  bannerColor: string;
  subscribers: number;
  createdAt: string;
  ownerName: string;
  isOwner?: boolean;
  isSubscribed?: boolean;
}

const iso = (daysAgo: number) =>
  new Date(Date.now() - daysAgo * 86400000).toISOString();

const demoChannelList: DemoChannel[] = [
  { id: "rc-avia", name: "RC Авиация России", slug: "rc-avia", description: "Официальный канал сообщества авиамоделистов: анонсы слётов, обзоры, разборы полётов.", category: "Самолёты", kind: "official", avatarColor: "#627FFF", bannerColor: "linear-gradient(135deg,#3f4fbf,#627fff)", subscribers: 8420, createdAt: iso(320), ownerName: "RC Авиация", isSubscribed: true },
  { id: "model-shop", name: "Магазин «Модель»", slug: "model-shop", description: "Новинки, поступления и спецпредложения крупнейшего магазина RC-запчастей.", category: "Запчасти", kind: "shop", avatarColor: "#F26C05", bannerColor: "linear-gradient(135deg,#b04c00,#f26c05)", subscribers: 15600, createdAt: iso(540), ownerName: "Модель", isSubscribed: false },
  { id: "fpv-lab", name: "FPV Lab", slug: "fpv-lab", description: "Сборки, настройка Betaflight, тесты железа и гоночные трассы FPV.", category: "Квадрокоптеры", kind: "expert", avatarColor: "#4caf50", bannerColor: "linear-gradient(135deg,#1b5e20,#4caf50)", subscribers: 6230, createdAt: iso(210), ownerName: "Михаил Квадро", isSubscribed: true },
  { id: "traxxas-ru", name: "Traxxas Россия", slug: "traxxas-ru", description: "Официальный бренд-канал: модельный ряд, гарантия, сервис и апгрейды.", category: "Автомодели", kind: "brand", avatarColor: "#e53935", bannerColor: "linear-gradient(135deg,#8e1c1c,#e53935)", subscribers: 11200, createdAt: iso(400), ownerName: "Traxxas", isSubscribed: false },
  { id: "diy-electronics", name: "DIY Электроника", slug: "diy-electronics", description: "Схемы, прошивки и разбор компонентов для самодельной RC-электроники.", category: "Электроника", kind: "author", avatarColor: "#1976d2", bannerColor: "linear-gradient(135deg,#0d47a1,#1976d2)", subscribers: 3980, createdAt: iso(160), ownerName: "Игорь Электрик", isSubscribed: false },
  { id: "sudomodel", name: "Судомоделизм", slug: "sudomodel", description: "Катера, парусники, копии кораблей — постройка и ходовые испытания.", category: "Корабли", kind: "expert", avatarColor: "#00897b", bannerColor: "linear-gradient(135deg,#004d40,#00897b)", subscribers: 2740, createdAt: iso(120), ownerName: "Дмитрий Моделист", isSubscribed: true },
];

// In-session subscription overrides so the demo stand can toggle "Подписаться"
// without a backend. Keyed by slug → subscribed? Resets on full reload
// (documented demo limitation), but stays consistent within a session.
const channelSubOverrides = new Map<string, boolean>();

function applySubOverride(c: DemoChannel): DemoChannel {
  const ov = channelSubOverrides.get(c.slug);
  if (ov === undefined) return c;
  if (ov === Boolean(c.isSubscribed)) return c;
  // Reflect the toggle in the subscriber count too, so the UI reads honestly.
  const delta = ov ? 1 : -1;
  return { ...c, isSubscribed: ov, subscribers: Math.max(0, c.subscribers + delta) };
}

/** Toggle a demo channel subscription for the current session. */
export function setDemoChannelSubscription(slug: string, subscribed: boolean): void {
  const ch = demoChannelList.find((c) => c.slug === slug || c.id === slug);
  if (!ch) return;
  channelSubOverrides.set(ch.slug, subscribed);
}

export function demoChannels(): DemoChannel[] {
  return demoChannelList.map(applySubOverride);
}

export function demoChannel(slug: string): DemoChannel | null {
  const found = demoChannelList.find((c) => c.slug === slug || c.id === slug);
  return found ? applySubOverride(found) : null;
}

export interface DemoChannelPost {
  id: string;
  channelId: string;
  authorName: string;
  createdAt: string;
  text: string;
  status: "published";
  likes: number;
  views: number;
  kind?: "news" | "review" | "announce" | "promo";
}

export function demoChannelPosts(slug: string): DemoChannelPost[] {
  const ch = demoChannel(slug);
  if (!ch) return [];
  const base = ch.name;
  const mk = (
    i: number,
    text: string,
    kind: DemoChannelPost["kind"],
    likes: number,
    views: number,
    daysAgo: number,
  ): DemoChannelPost => ({
    id: `${ch.id}-p${i}`,
    channelId: ch.id,
    authorName: base,
    createdAt: iso(daysAgo),
    text,
    status: "published",
    likes,
    views,
    kind,
  });
  return [
    mk(1, "Открыта регистрация на летний слёт — три дня полётов, swap-meet запчастей и мастер-классы для новичков.", "announce", 214, 5820, 1),
    mk(2, "Разобрали новый регулятор хода: тесты под нагрузкой, температура и КПД. Подробный обзор с графиками.", "review", 96, 3110, 4),
    mk(3, "Новое поступление аккумуляторов и зарядных устройств. Для подписчиков канала — скидка 10% по промокоду.", "promo", 58, 2040, 7),
    mk(4, "Итоги весеннего сезона: лучшие сборки сообщества, топ-5 моделей и планы на следующий этап.", "news", 132, 4260, 12),
  ];
}

// ── chat / messenger ─────────────────────────────────────────────────────────
export function demoConversations(): Dialog[] {
  return mockDialogs;
}

export function demoMessages(dialogId: ID): Message[] {
  return mockDialogs.find((d) => d.id === dialogId)?.messages ?? [];
}

// ── social / friends ─────────────────────────────────────────────────────────
export function demoFriends(): User[] {
  const ids = DEMO_USER.friendIds ?? [];
  return mockUsers.filter((u) => ids.includes(u.id));
}

export interface DemoIncomingRequest {
  id: number;
  from: User;
  date: string;
}

export function demoIncomingRequests(): DemoIncomingRequest[] {
  return [
    { id: 9001, from: mockUsers.find((u) => u.id === "u4")!, date: iso(1) },
    { id: 9002, from: mockUsers.find((u) => u.id === "u8")!, date: iso(3) },
  ];
}

export function demoSearchUsers(q?: string): User[] {
  const friendIds = new Set(DEMO_USER.friendIds ?? []);
  const pool = mockUsers.filter((u) => u.id !== DEMO_USER.id && !friendIds.has(u.id));
  if (!q) return pool;
  const s = q.toLowerCase();
  return pool.filter(
    (u) => u.name.toLowerCase().includes(s) || u.city.toLowerCase().includes(s),
  );
}

export interface DemoPublicProfile {
  user: User;
  bio: string;
  city: string;
  stats: { publications: number; followers: number; following: number; rating: number };
  memberSince?: string;
  isFollowing: boolean;
}

export function demoPublicProfile(slug: string): DemoPublicProfile {
  const u =
    mockUsers.find((x) => x.slug === slug || x.id === slug) ?? mockUsers[1];
  return {
    user: u,
    bio: u.bio ?? "",
    city: u.city,
    stats: { publications: 12, followers: 340, following: 128, rating: 4.9 },
    memberSince: u.joinedDate,
    isFollowing: false,
  };
}

// ── notifications ────────────────────────────────────────────────────────────
export interface DemoNotification {
  id: string;
  type: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
  createdAt: string;
}

const isoH = (hoursAgo: number) =>
  new Date(Date.now() - hoursAgo * 3600000).toISOString();

const demoNotificationList: DemoNotification[] = [
  { id: "n1", type: "message", title: "Новое сообщение", body: "Сергей ДВС: Да, конечно! Скину схему вечером", link: "/messenger", read: false, createdAt: isoH(0.2) },
  { id: "n2", type: "friend_request", title: "Заявка в друзья", body: "Андрей Самолёты хочет добавить вас в друзья", link: "/friends", read: false, createdAt: isoH(2) },
  { id: "n3", type: "listing", title: "Ваше объявление одобрено", body: "«Двигатель ДВС Picco .21» опубликовано", link: "/ads", read: false, createdAt: isoH(5) },
  { id: "n4", type: "community", title: "Новый пост в сообществе", body: "FPV Академия: расписание летних заездов", link: "/communities", read: true, createdAt: isoH(26) },
  { id: "n5", type: "like", title: "Ваш пост оценили", body: "12 моделистов лайкнули «Новый проект на шасси 1:8»", link: "/feed", read: true, createdAt: isoH(50) },
  { id: "n6", type: "system", title: "Добро пожаловать!", body: "Вы получили бейдж «Основатель» — первые 100 участников", link: "/profile", read: true, createdAt: isoH(120) },
];

export function demoNotifications(): { items: DemoNotification[]; unread: number } {
  return {
    items: demoNotificationList,
    unread: demoNotificationList.filter((n) => !n.read).length,
  };
}

// ── categories ───────────────────────────────────────────────────────────────
export function demoCategories(): Category[] {
  return mockCategories;
}

// ── cities ───────────────────────────────────────────────────────────────────
export interface DemoCity {
  id: number;
  name: string;
  region?: string | null;
  slug?: string;
}

const demoCityList: DemoCity[] = [
  { id: 1, name: "Москва", region: "Москва" },
  { id: 2, name: "Санкт-Петербург", region: "Санкт-Петербург" },
  { id: 3, name: "Краснодар", region: "Краснодарский край" },
  { id: 4, name: "Новосибирск", region: "Новосибирская область" },
  { id: 5, name: "Екатеринбург", region: "Свердловская область" },
  { id: 6, name: "Казань", region: "Татарстан" },
  { id: 7, name: "Сочи", region: "Краснодарский край" },
  { id: 8, name: "Ростов-на-Дону", region: "Ростовская область" },
];

export function demoCities(query?: string): DemoCity[] {
  if (!query) return demoCityList;
  const q = query.toLowerCase();
  return demoCityList.filter((c) => c.name.toLowerCase().includes(q));
}

// ── banners ──────────────────────────────────────────────────────────────────
export function demoBanners(): Banner[] {
  return mockBanners;
}

// ── faq / stats ──────────────────────────────────────────────────────────────
export interface DemoFaqCategory {
  id: number;
  slug: string;
  name: string;
  articles: { id: number; question: string; answer: string }[];
}

export function demoFaq(): DemoFaqCategory[] {
  return faqCategories
    .filter((c) => c.id !== "all")
    .map((cat, ci) => ({
      id: ci + 1,
      slug: String(cat.id),
      name: cat.label,
      articles: faqItems
        .filter((f) => f.category === cat.id)
        .map((f, i) => ({ id: ci * 100 + i, question: f.question, answer: f.answer })),
    }));
}

export function demoStats(): { firstHundred: { taken: number; total: number } } {
  return { firstHundred: firstHundredStats };
}
