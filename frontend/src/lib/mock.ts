// Mock data for МоДелизМ prototype
import { categoryPlaceholder } from "@/lib/placeholder-image";

export type ID = string;

export interface User {
  id: ID;
  numericId?: number;
  slug?: string;
  name: string;
  city: string;
  interests: string;
  avatar: string;
  email?: string;
  subscription?: "Тестовый" | "Месяц" | "Полгода" | "Год" | null;
  bio?: string;
  status?: string;
  coverImage?: string;
  joinedDate?: string;
  friendIds?: ID[];
  online?: boolean;
  isAdmin?: boolean;
  firstHundred?: boolean;
  /** Server-only fields carried through from ApiUser for settings.account.tsx
   *  (phone/social links/email-verification status) — not part of the core
   *  mock-data shape, so kept optional and undefined in demo mode. */
  phone?: string | null;
  profile?: {
    vk_url?: string | null;
    telegram_url?: string | null;
    website_url?: string | null;
  } | null;
  email_verified?: boolean;
  /** Server role — drives the /admin RBAC gate (Task 2) and moderator-scoped
   *  dashboard (Task 3). Undefined in most demo-mode contexts; the gate
   *  falls back to `isAdmin` there (see Task 2). */
  role?: "user" | "subscriber" | "moderator" | "admin";
}

export const firstHundredStats = { taken: 47, total: 100 };

export interface FriendRequest {
  id: ID;
  fromId: ID;
  toId: ID;
  status: "pending" | "accepted" | "rejected";
  date: string;
}

export interface Comment {
  id: ID;
  authorId: ID;
  time: string;
  text: string;
  likes?: number;
  replies?: Comment[];
}

export interface VideoCategory {
  id: ID;
  name: string;
  slug: string;
}

export interface Video {
  id: ID;                    // uuid
  title: string;
  description: string;
  categoryId: ID;            // -> VideoCategory.id
  posterUrl: string;
  videoUrl: string;
  durationSeconds: number;
  views: number;             // passive watch counter, separate from likes/comments
  isFeatured: boolean;       // hero-carousel curation
  tags: string[];
  publishedAt: string;       // ISO date, newest-first sort key
  uploaderId: ID;
  status: "processing" | "published";
  // Social fields — mirror the relevant Post interaction fields. Likes + comments only.
  likes: number;
  comments: number;
  isLiked?: boolean;
  commentList?: Comment[];   // the SAME Comment type, reused unchanged
}

export interface Post {
  id: ID;
  authorId: ID;
  date: string;
  category: string;
  title: string;
  text: string;
  image?: string;
  images?: string[];
  tags?: string[];
  views?: number;
  likes: number;
  comments: number;
  saves?: number;
  reposts?: number;
  status?: "published" | "moderation";
  isFollowing?: boolean;
  isLiked?: boolean;
  isSaved?: boolean;
  isReposted?: boolean;
  repostComment?: string;
  commentList?: Comment[];
  repostedBy?: ID;
}

export type AdCondition = "Новое" | "Б/у — отлично" | "Б/у — хорошо" | "Под восстановление";

export interface AdSeller {
  id: ID;
  numericId?: number;
  name: string;
  avatar: string;
  rating: number;
  deals: number;
  since: string;
  /** Demo-only for now — no backend field exists yet (see
   *  backend-endpoints-needed.md #22). Populated by makeSeller() below;
   *  undefined for any seller not in SELLER_PHONES. */
  phone?: string;
}

export interface Ad {
  id: ID;
  title: string;
  price: number;
  category: string;
  subcategory: string;
  city: string;
  image: string;
  gallery?: string[];
  description?: string;
  delivery: string[];
  deliveryDetails?: string;
  condition?: AdCondition;
  status: "Продаю" | "Куплю" | "Обменяю";
  contact: string;
  authorId: ID;
  seller?: AdSeller;
  views?: number;
  likes?: number;
  createdAt?: string;
  moderation?: "published" | "moderation" | "rejected";
  /** Currently boosted/продвигается (Stage 5). On the real backend this comes
   *  from ListingResource (is_promoted / promoted_until) — not yet exposed. */
  promoted?: boolean;
}

export interface Category {
  id: ID;
  name: string;
  description: string;
  icon: string; // lucide icon name
  members: number;
  listingsCount?: number;
  subcategories: { id: ID; name: string }[];
}

export interface CommunityContacts {
  website?: string;
  phone?: string;
}

export interface Community {
  id: ID;
  name: string;
  description: string;
  fullDescription?: string;
  members: number;
  category: string;
  joined?: boolean;
  coverImage?: string;
  avatarImage?: string;
  avatarIcon?: string;
  adminId?: ID;
  postIds?: ID[];
  contacts?: CommunityContacts;
  allowSubmitPost?: boolean;
}

export interface Banner {
  id: ID;
  title: string;
  text: string;
  cta: string;
  until: string;
  color: string;
  image?: string;
  link?: string;
  kind?: "event" | "news" | "promo";
  pinned?: boolean;
  priority?: number;
  scheduleFrom?: string;
  scheduleTo?: string;
  active?: boolean;
}

export interface Tariff {
  id: ID;
  name: string;
  price: number;
  period: string;
  features: string[];
  popular?: boolean;
}

export interface VoiceMessage {
  duration: number; // seconds
  waveform: number[]; // normalized 0..1 bar heights
  transcript?: string; // optional speech-to-text (not produced for real recordings)
  src?: string; // playable audio URL for real voice notes
}

export interface MessageFile {
  name: string;
  size: number; // bytes
  kind: "video" | "file";
  url: string; // blob: URL (demo) or real URL
}

export interface Message {
  id: ID;
  authorId: ID;
  time: string;
  text: string;
  status?: "sent" | "delivered" | "read";
  replyTo?: ID;
  image?: string;
  voice?: VoiceMessage;
  file?: MessageFile;
  pinned?: boolean;
  deletedForMe?: boolean;
  forwardedFrom?: ID;
}

export const VOICE_TRANSCRIPTS: string[] = [
  "Сегодня протестировал новую серву на автомодели, ход стал намного точнее. Думаю, на следующих заездах буду пробовать более агрессивные настройки развала.",
  "Аккумулятор после зимы держит заряд хуже, думаю заменить на новый комплект. Старые липольки уже подвздулись, рисковать не хочется.",
  "На квадрокоптере пришлось заново калибровать контроллер, после этого полёт стал стабильнее. Гироскоп немного уплывал, но прошивка свежая помогла.",
  "Для масштаба 1:10 лучше поставить другие шины, на асфальте будет меньше срыва. Сликовые в самый раз для гладкого покрытия.",
  "Перепаял регулятор хода, теперь не греется даже на максималке. Радиатор поставил побольше, термопасту обновил.",
  "По FPV-очкам всё настроил, картинка чёткая, задержки почти нет. Антенны клеверные дают стабильный сигнал на дистанции.",
  "Разобрал редуктор, шестерни в порядке, просто смазка высохла. Залил свежую, собрал — работает как новый.",
];

export function makeMockWaveform(seed: number): number[] {
  const bars = 32;
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < bars; i++) {
    s = (s * 9301 + 49297) % 233280;
    const n = s / 233280;
    out.push(0.25 + n * 0.75);
  }
  return out;
}

export interface Dialog {
  id: ID;
  userId: ID;
  lastMessage: string;
  time: string;
  unread?: number;
  messages: Message[];
  pinned?: boolean;
  listing?: DialogAdRef;
}

export interface DialogAdRef {
  id: ID;
  title: string;
  price: number;
  image?: string;
}

export interface DialogAdRef {
  id: ID;
  title: string;
  price: number;
  image?: string;
}

// Evenly-weighted palette (same "600" saturation/lightness class per color)
// so initials avatars read as one consistent set — the previous palette
// (one saturated red + three grays) skewed heavily toward red by DiceBear's
// hash distribution (5 of 8 demo users landed on the same red).
const avatar = (seed: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed)}&backgroundColor=4f46e5,059669,d97706,dc2626,7c3aed,0891b2,db2777,65a30d`;

const photo = (id: number) =>
  `https://picsum.photos/seed/modelizm${id}/800/600`;

export const users: User[] = [
  { id: "u1", numericId: 1, name: "Александр RC", city: "Краснодар", interests: "RC авто, ДВС 1:8, багги, гонки", avatar: avatar("Александр RC"), subscription: "Год", bio: "Гоняю RC авто с 2015 года. Строю багги на базе HB Racing. Организую заезды в Краснодаре.", status: "В проекте с 2024", coverImage: photo(101), joinedDate: "2024-03-15T10:00:00Z", friendIds: ["u2","u3","u5","u6","u7"], online: true, isAdmin: true, firstHundred: true },
  { id: "u2", numericId: 2, name: "Сергей ДВС", city: "Москва", interests: "Двигатели, тюнинг, ДВС, нитро", avatar: avatar("Сергей ДВС"), subscription: "Месяц", bio: "Двигателист со стажем. Знаю о ДВС всё: от обкатки до форсирования. Помогу с настройкой.", status: "Чемпион гонок 2025", coverImage: photo(102), joinedDate: "2024-04-02T14:30:00Z", friendIds: ["u1","u4"], online: true },
  { id: "u3", numericId: 3, name: "Михаил Квадро", city: "Санкт-Петербург", interests: "FPV, квадрокоптеры, видео, 5дюймов", avatar: avatar("Михаил Квадро"), subscription: "Полгода", bio: "FPV-пилот. Летаю на 5-дюймовых рамах. Снимаю видео с коптера. Ищу напарников для совместных полётов.", coverImage: photo(103), joinedDate: "2024-05-20T08:00:00Z", friendIds: ["u1","u6","u8"], online: false },
  { id: "u4", numericId: 4, name: "Андрей Самолёты", city: "Новосибирск", interests: "Авиамодели, планеры, реставрация", avatar: avatar("Андрей Самолёты"), subscription: null, bio: "Авиамоделист. Восстанавливаю советские модели. Ищу редкие декали и чертежи.", coverImage: photo(104), joinedDate: "2024-06-10T12:00:00Z", friendIds: ["u2"], online: true },
  { id: "u5", numericId: 5, name: "Дмитрий Моделист", city: "Екатеринбург", interests: "Корабли, катера, парусники", avatar: avatar("Дмитрий Моделист"), subscription: "Месяц", bio: "Судомоделист из Екатеринбурга. Строю катера на ДВС и электротяге.", coverImage: photo(105), joinedDate: "2024-07-01T09:00:00Z", friendIds: ["u1"], online: false },
  { id: "u6", numericId: 6, name: "Игорь Электрик", city: "Казань", interests: "Электроника, DIY, пайка, ESC", avatar: avatar("Игорь Электрик"), subscription: "Месяц", bio: "DIY-электронщик. Паяю контроллеры, ESC, датчики. Делюсь схемами и прошивками.", status: "Мастер пайки", coverImage: photo(106), joinedDate: "2024-08-15T16:00:00Z", friendIds: ["u1","u3"], online: true },
  { id: "u7", numericId: 7, name: "Павел Самокат", city: "Сочи", interests: "Электросамокаты, моды, аккумуляторы", avatar: avatar("Павел Самокат"), subscription: null, bio: "Моддинг электросамокатов: аккумуляторы, прошивки, контроллеры.", coverImage: photo(107), joinedDate: "2025-01-10T11:00:00Z", friendIds: ["u1"], online: false },
  { id: "u8", numericId: 8, name: "Олег Разработчик", city: "Ростов-на-Дону", interests: "Автопилоты, прошивки, STM32", avatar: avatar("Олег Разработчик"), subscription: "Год", bio: "Разрабатываю автопилоты на базе STM32. Пишу прошивки под ArduPilot и PX4.", status: "Разработчик", coverImage: photo(108), joinedDate: "2024-09-01T07:00:00Z", friendIds: ["u3"], online: true },
];

export const friendRequests: FriendRequest[] = [
  { id: "fr1", fromId: "u4", toId: "u1", status: "pending", date: "2026-06-19T14:22:00Z" },
  { id: "fr2", fromId: "u7", toId: "u1", status: "pending", date: "2026-06-18T09:15:00Z" },
  { id: "fr3", fromId: "u8", toId: "u1", status: "pending", date: "2026-06-17T20:30:00Z" },
];

export const me: User = users[0];

// Sorted alphabetically (ru collation) — this order drives the display order
// everywhere categories are listed (feed right rail, /categories, "Найди
// своих" sheet, post composer). Existing ids/subcategory names are unchanged
// so posts/ads that reference a category or subcategory by name still match.
export const categories: Category[] = [
  { id: "c11", name: "3D-печать", description: "3D-принтеры, модели, материалы", icon: "Printer", members: 610, subcategories: [{ id: "s1", name: "Принтеры" }, { id: "s2", name: "Пластик и материалы" }] },
  {
    id: "c1", name: "Автомодели", description: "RC авто всех масштабов", icon: "Car", members: 2840,
    subcategories: [
      { id: "s1", name: "Масштаб 1:5" },
      { id: "s2", name: "Масштаб 1:8" },
      { id: "s3", name: "Масштаб 1:10" },
      { id: "s4", name: "Масштаб 1:16" },
      { id: "s5", name: "ДВС" },
      { id: "s6", name: "Электро" },
      { id: "s7", name: "Тюнинг" },
      { id: "s8", name: "Запчасти" },
    ],
  },
  { id: "c6", name: "Аккумуляторы", description: "LiPo, Li-ion, NiMH", icon: "BatteryCharging", members: 890, subcategories: [{ id: "s1", name: "LiPo" }, { id: "s2", name: "Li-ion" }] },
  { id: "c12", name: "Военная техника", description: "Танки, БТР, военные модели", icon: "Shield", members: 860, subcategories: [{ id: "s1", name: "Танки" }, { id: "s2", name: "БТР и техника" }] },
  { id: "c13", name: "Железные дороги", description: "Масштабные ж/д модели и макеты", icon: "TrainFront", members: 430, subcategories: [{ id: "s1", name: "Локомотивы" }, { id: "s2", name: "Макеты" }] },
  { id: "c10", name: "Запчасти", description: "Детали и комплектующие", icon: "Wrench", members: 2210, subcategories: [{ id: "s1", name: "Шасси" }, { id: "s2", name: "Моторы" }] },
  { id: "c14", name: "Инструменты", description: "Станки, инструмент для мастерской", icon: "Hammer", members: 720, subcategories: [{ id: "s1", name: "Ручной инструмент" }, { id: "s2", name: "Станки" }] },
  { id: "c4", name: "Квадрокоптеры", description: "FPV, дроны, мультироторы", icon: "Send", members: 3180, subcategories: [{ id: "s1", name: "FPV" }, { id: "s2", name: "Съёмочные" }] },
  { id: "c3", name: "Корабли", description: "Катера и судомодели", icon: "Ship", members: 740, subcategories: [{ id: "s1", name: "Катера" }, { id: "s2", name: "Парусники" }] },
  { id: "c15", name: "Мотоциклы", description: "RC мотоциклы и мотомодели", icon: "Bike", members: 390, subcategories: [{ id: "s1", name: "Модели" }, { id: "s2", name: "Запчасти" }] },
  { id: "c16", name: "Оптика и камеры", description: "Экшн-камеры, объективы, FPV-оптика", icon: "Camera", members: 560, subcategories: [{ id: "s1", name: "Экшн-камеры" }, { id: "s2", name: "Объективы" }] },
  { id: "c7", name: "Радиоаппаратура", description: "Пульты, приёмники", icon: "Radio", members: 1120, subcategories: [{ id: "s1", name: "Пульты" }, { id: "s2", name: "Приёмники" }] },
  { id: "c9", name: "Разработчики", description: "Прошивки, автопилоты", icon: "Code2", members: 540, subcategories: [{ id: "s1", name: "Автопилоты" }, { id: "s2", name: "Прошивки" }] },
  { id: "c17", name: "Ракетомоделизм", description: "Модельные ракеты и двигатели", icon: "Rocket", members: 310, subcategories: [{ id: "s1", name: "Ракеты" }, { id: "s2", name: "Двигатели" }] },
  { id: "c18", name: "Робототехника", description: "Роботы, конструкторы, наборы", icon: "Bot", members: 480, subcategories: [{ id: "s1", name: "Конструкторы" }, { id: "s2", name: "Комплектующие" }] },
  { id: "c2", name: "Самолёты", description: "Авиамодели и планеры", icon: "Plane", members: 1920, subcategories: [{ id: "s1", name: "Планеры" }, { id: "s2", name: "Пилотажки" }] },
  { id: "c19", name: "Спецтехника", description: "RC-модели строительной техники", icon: "Truck", members: 340, subcategories: [{ id: "s1", name: "Модели" }, { id: "s2", name: "Гидравлика" }] },
  { id: "c20", name: "Стендовые модели", description: "Сборные пластиковые модели", icon: "Blocks", members: 970, subcategories: [{ id: "s1", name: "Военная техника" }, { id: "s2", name: "Гражданская техника" }] },
  { id: "c5", name: "Электроника", description: "Платы, датчики, DIY", icon: "Cpu", members: 1450, subcategories: [{ id: "s1", name: "Контроллеры" }, { id: "s2", name: "Датчики" }] },
  { id: "c8", name: "Электросамокаты", description: "Самокаты и моды", icon: "Zap", members: 980, subcategories: [{ id: "s1", name: "Контроллеры" }, { id: "s2", name: "Моды" }] },
];


const cmt = (id: string, authorId: ID, time: string, text: string, likes = 0, replies: Comment[] = []): Comment => ({ id, authorId, time, text, likes, replies });

export const posts: Post[] = [
  { id: "p1", authorId: "u1", date: "2 ч назад", category: "Автомодели", title: "Новый проект на шасси 1:8", text: "Собрал новый багги на базе HB Racing. Делюсь первыми впечатлениями от обкатки ДВС: на первых баках мотор работал стабильно, температура головы держалась в районе 110°C, что для нового двигателя — отличный показатель. После 4 баков перешёл на штатный режим и сразу заметил прирост отзывчивости.", image: photo(1), tags: ["ДВС", "1:8", "багги", "HBRacing"], views: 1240, likes: 42, comments: 3, saves: 18, reposts: 4, isFollowing: true, commentList: [
    cmt("c1", "u2", "1 ч назад", "Какую свечу ставил? У меня на той же голове перегревала.", 5, [
      cmt("c1r1", "u1", "55 мин назад", "OS A5, средняя. На нитро 25% — оптимально.", 2),
    ]),
    cmt("c2", "u4", "40 мин назад", "Красивый багги! Сколько весит в сборе?", 1),
    cmt("c3", "u6", "20 мин назад", "Поделись настройками иглы потом", 0),
  ] },
  { id: "p2", authorId: "u3", date: "4 ч назад", category: "Квадрокоптеры", title: "FPV полёт над лесом", text: "Снял красивое видео на 5-дюймовой раме с GoPro. Настройки PID наконец-то идеальные.", image: photo(2), tags: ["FPV", "5дюймов", "GoPro"], views: 3420, likes: 88, comments: 2, saves: 34, reposts: 9, isFollowing: true, commentList: [
    cmt("c1", "u6", "3 ч назад", "PID поделишься?", 3),
    cmt("c2", "u8", "2 ч назад", "Какая частота? 2.4 или 5.8?", 1),
  ] },
  { id: "p3", authorId: "u4", date: "вчера", category: "Самолёты", title: "Реставрация Як-52", text: "Восстанавливаю модель Як-52 в масштабе 1:6. Ищу комплект декалей.", image: photo(3), tags: ["Як52", "1:6", "реставрация"], views: 890, likes: 31, comments: 1, saves: 7, reposts: 2, commentList: [
    cmt("c1", "u5", "23 ч назад", "У меня остался комплект, напиши в личку", 4),
  ] },
  { id: "p4", authorId: "u2", date: "вчера", category: "Запчасти", title: "Обзор нового мотора Castle 1717", text: "Поставил на дрэгстер. Отдача — космос. Подробности в посте.", image: photo(4), tags: ["Castle", "дрэгстер", "мотор"], views: 1560, likes: 56, comments: 2, saves: 22, reposts: 6, isFollowing: true, commentList: [
    cmt("c1", "u1", "20 ч назад", "Какой ESC использовал?", 2),
    cmt("c2", "u7", "18 ч назад", "Цена вопроса?", 0),
  ] },
  { id: "p5", authorId: "u6", date: "2 дня назад", category: "Электроника", title: "Самодельный контроллер ESC", text: "Спаял свой ESC на STM32. Поделюсь схемой и прошивкой.", image: photo(5), tags: ["ESC", "STM32", "DIY"], views: 2110, likes: 73, comments: 2, saves: 41, reposts: 11, commentList: [
    cmt("c1", "u8", "1 день назад", "Схему в студию!", 6),
    cmt("c2", "u2", "1 день назад", "Какая макс мощность?", 1),
  ] },
  { id: "p6", authorId: "u5", date: "3 дня назад", category: "Корабли", title: "Радиоуправляемый катер своими руками", text: "Корпус из стеклопластика, мотор 540. Первые ходовые испытания на пруду.", image: photo(6), tags: ["катер", "стеклопластик", "DIY"], views: 640, likes: 22, comments: 1, saves: 5, reposts: 1, commentList: [cmt("c1", "u3", "2 дня назад", "Скорость какая?", 0)] },
  { id: "p7", authorId: "u8", date: "3 дня назад", category: "Разработчики", title: "ArduPilot 4.5 — что нового", text: "Разбор основных фич нового релиза автопилота.", image: photo(7), tags: ["ArduPilot", "автопилот"], views: 1340, likes: 41, comments: 0, saves: 28, reposts: 7, isFollowing: true, commentList: [] },
  { id: "p8", authorId: "u7", date: "4 дня назад", category: "Электросамокаты", title: "Моддинг контроллера на самокате", text: "Поставил кастомную прошивку, мощность +30%.", image: photo(8), tags: ["прошивка", "мод"], views: 520, likes: 19, comments: 0, saves: 3, reposts: 0, commentList: [] },
  { id: "p9", authorId: "u1", date: "5 дней назад", category: "Автомодели", title: "Гонки в Краснодаре — итоги", text: "Прошли весенние гонки. Сделал фотоотчёт и обзор шасси участников.", image: photo(9), tags: ["гонки", "Краснодар"], views: 1880, likes: 64, comments: 1, saves: 19, reposts: 5, isFollowing: true, commentList: [cmt("c1", "u4", "4 дня назад", "Огонь репортаж!", 3)] },
  { id: "p10", authorId: "u3", date: "неделю назад", category: "Квадрокоптеры", title: "Сборка 7-дюймового лонг-рейнджа", text: "Дальность 12 км, время полёта 25 минут. Конфигурация внутри.", image: photo(10), tags: ["7дюймов", "longrange"], views: 2960, likes: 95, comments: 1, saves: 52, reposts: 14, isFollowing: true, commentList: [cmt("c1", "u8", "6 дней назад", "Какая батарея?", 4)] },
  { id: "p11", authorId: "u4", date: "неделю назад", category: "Самолёты", title: "Первый полёт планера 2.5м", text: "Сделал планер с пенополистирола, размах 2.5 м. Парит шикарно, термики ловит уверенно.", image: photo(21), tags: ["планер", "термики"], views: 720, likes: 28, comments: 0, saves: 9, reposts: 2, commentList: [] },
  { id: "p12", authorId: "u2", date: "неделю назад", category: "Запчасти", title: "Распаковка нового сервопривода Savox", text: "Пришёл Savox SC-1256TG. Усилие 20 кг·см, скорость 0.15 сек.", image: photo(22), tags: ["Savox", "сервопривод"], views: 980, likes: 36, comments: 0, saves: 14, reposts: 3, commentList: [] },
  { id: "p13", authorId: "u6", date: "10 дней назад", category: "Электроника", title: "Разбор приёмника FrSky R-XSR", text: "Маленький, лёгкий, бьёт далеко. Подробный обзор и тесты.", image: photo(23), tags: ["FrSky", "приёмник"], views: 1450, likes: 47, comments: 0, saves: 21, reposts: 6, isFollowing: true, commentList: [] },
  { id: "p14", authorId: "u8", date: "10 дней назад", category: "Разработчики", title: "Настройка автопилота для дальних миссий", text: "Параметры failsafe, RTL, точки маршрута — мой подход.", image: photo(24), tags: ["автопилот", "missions"], views: 1120, likes: 39, comments: 0, saves: 27, reposts: 8, commentList: [] },
  { id: "p15", authorId: "u1", date: "2 недели назад", category: "Автомодели", title: "Замена амортизаторов на 1:10", text: "Поставил алюминиевые на туринг. Машина перестала козлить на буграх.", image: photo(25), tags: ["1:10", "туринг", "амортизаторы"], views: 1340, likes: 51, comments: 0, saves: 16, reposts: 4, isFollowing: true, commentList: [] },
  { id: "p16", authorId: "u3", date: "2 недели назад", category: "Квадрокоптеры", title: "Cinewhoop для съёмок интерьеров", text: "Собрал 3-дюймовый сайнвуп под GoPro Naked. Идеален для интерьеров.", image: photo(26), tags: ["Cinewhoop", "съёмка"], views: 2180, likes: 79, comments: 0, saves: 38, reposts: 12, commentList: [] },
  { id: "p17", authorId: "u5", date: "2 недели назад", category: "Корабли", title: "Парусник на радиоуправлении", text: "Сделал парусную яхту 1:50. Ветер ловит — улетает по пруду.", image: photo(27), tags: ["парусник", "яхта"], views: 580, likes: 24, comments: 0, saves: 6, reposts: 1, commentList: [] },
  { id: "p18", authorId: "u7", date: "3 недели назад", category: "Электросамокаты", title: "Новый аккумулятор 60V 30Ah", text: "Сборка из 21700 ячеек. Запас хода теперь +50%.", image: photo(28), tags: ["батарея", "21700"], views: 690, likes: 26, comments: 0, saves: 8, reposts: 2, commentList: [] },
  { id: "p19", authorId: "u6", date: "3 недели назад", category: "Электроника", title: "Pixhawk 6C — обзор", text: "Новый Pixhawk вышел. Что внутри и зачем оно надо.", image: photo(29), tags: ["Pixhawk", "обзор"], views: 1820, likes: 62, comments: 0, saves: 33, reposts: 9, commentList: [] },
  { id: "p20", authorId: "u2", date: "месяц назад", category: "Запчасти", title: "Подборка моторов для багги 1:8", text: "Сравнил Reds, OS, Picco. Кто лучше держит температуру.", image: photo(30), tags: ["моторы", "сравнение"], views: 2410, likes: 87, comments: 0, saves: 44, reposts: 13, isFollowing: true, commentList: [] },
  { id: "p21", authorId: "u6", date: "месяц назад", category: "Электроника", title: "Самодельный GPS-трекер для модели", text: "Маленький модуль на ESP32 + L80 GPS. Шлёт координаты по LoRa на 5 км. Идеально для поиска улетевшего самолёта.", image: photo(31), tags: ["GPS", "ESP32", "LoRa"], views: 980, likes: 38, comments: 0, saves: 19, reposts: 5, commentList: [] },
  { id: "p22", authorId: "u1", date: "месяц назад", category: "Автомодели", title: "Сезон открыт: первые гонки 2026", text: "Стартанули в Краснодаре. 18 пилотов, 3 класса. Фотоотчёт и краткий анализ круга лидеров.", images: [photo(32), photo(33)], tags: ["гонки", "сезон2026"], views: 3200, likes: 104, comments: 1, saves: 47, reposts: 18, isFollowing: true, commentList: [cmt("c1", "u4", "3 нед назад", "Огонь сезон стартанул!", 5)] },
];

const gal = (seeds: number[], category: string) => seeds.map((s) => categoryPlaceholder(`mz-ad${s}`, category));

const SELLER_PHONES: Record<string, string> = {
  u1: "+7 901 234-56-01",
  u2: "+7 901 234-56-02",
  u3: "+7 901 234-56-03",
  u4: "+7 901 234-56-04",
  u5: "+7 901 234-56-05",
  u6: "+7 901 234-56-06",
  u7: "+7 901 234-56-07",
  u8: "+7 901 234-56-08",
};

const makeSeller = (uid: ID, rating: number, deals: number, since: string): AdSeller => {
  const u = users.find((x) => x.id === uid) ?? users[0];
  return { id: u.id, numericId: u.numericId, name: u.name, avatar: u.avatar, rating, deals, since, phone: SELLER_PHONES[u.id] };
};

const rawAds: Array<Omit<Ad, "image" | "gallery" | "seller"> & { seeds: number[]; sellerStats: [number, number, string] }> = [
  { id: "a1", title: "Двигатель ДВС Picco .21 для багги 1:8", price: 18000, category: "Автомодели", subcategory: "ДВС", city: "Краснодар", delivery: ["СДЭК", "Почта России"], deliveryDetails: "Отправка в день оплаты, трек предоставляется. Самовывоз в центре Краснодара.", condition: "Б/у — отлично", status: "Продаю", contact: "+7 900 000-00-01", authorId: "u1", description: "Двигатель Picco P3 21 в отличном состоянии. Откатан 8 баков, компрессия живая, гильза-поршень без задиров. Свеча новая OS A5. Подходит для багги и трагги класса 1:8. Продаю по причине перехода на электро.", views: 1240, likes: 18, createdAt: "2 часа назад", promoted: true, seeds: [11, 111, 112, 113, 114], sellerStats: [4.9, 47, "март 2022"] },
  { id: "a2", title: "Комплект колёс Pro-Line Trencher 1:8 (4 шт)", price: 4500, category: "Автомодели", subcategory: "Запчасти", city: "Москва", delivery: ["СДЭК", "Яндекс Доставка"], deliveryDetails: "Доставка по Москве курьером в день заказа. По регионам — СДЭК.", condition: "Новое", status: "Продаю", contact: "+7 900 000-00-02", authorId: "u2", description: "Новые колёса Pro-Line Trencher 3.8\" на чёрных дисках. Шипованный протектор для бездорожья. Подходят на трагги и монстры 1:8.", views: 820, likes: 12, createdAt: "5 часов назад", seeds: [12, 121, 122, 123], sellerStats: [4.8, 32, "июль 2021"] },
  { id: "a3", title: "Аккумулятор LiPo 6S 5000mAh 50C XT90", price: 3200, category: "Аккумуляторы", subcategory: "LiPo", city: "Санкт-Петербург", delivery: ["СДЭК"], deliveryDetails: "Аккумуляторы отправляются только СДЭК (наземкой), без авиа.", condition: "Б/у — отлично", status: "Продаю", contact: "tg @rc_spb", authorId: "u3", description: "LiPo 6S2P 5000mAh, 50C, разъём XT90. Использовался один сезон в FPV-квадрокоптере 7\". Циклов ~40, баланс ячеек идеальный (3.85 в покое). Без вздутий.", views: 2150, likes: 34, createdAt: "вчера", seeds: [13, 131, 132, 133, 134], sellerStats: [5.0, 89, "ноябрь 2020"] },
  { id: "a4", title: "Рама квадрокоптера iFlight Nazgul5 V3", price: 2800, category: "Квадрокоптеры", subcategory: "FPV", city: "Казань", delivery: ["Почта России", "СДЭК"], deliveryDetails: "Отправка по предоплате, упаковка в пузырчатую плёнку.", condition: "Новое", status: "Продаю", contact: "+7 900 000-00-04", authorId: "u6", description: "Рама iFlight Nazgul5 V3, 5\" фристайл, толщина лучей 6мм. Полный комплект крепежа, ТПУ-маунты под GoPro.", views: 1480, likes: 22, createdAt: "вчера", seeds: [14, 141, 142], sellerStats: [4.7, 21, "май 2023"] },
  { id: "a5", title: "Пульт Radiomaster TX16S MKII ELRS", price: 22000, category: "Радиоаппаратура", subcategory: "Пульты", city: "Москва", delivery: ["СДЭК", "Ozon"], deliveryDetails: "Полный комплект с зарядкой, оригинальная коробка.", condition: "Б/у — отлично", status: "Продаю", contact: "+7 900 000-00-05", authorId: "u4", description: "Radiomaster TX16S MKII, прошивка EdgeTX последняя, модуль ELRS внутренний 1W. Стики Hall-эффект AG01. Состояние идеальное, не падал.", views: 3210, likes: 56, createdAt: "2 дня назад", seeds: [15, 151, 152, 153, 154], sellerStats: [4.9, 64, "февраль 2022"] },
  { id: "a6", title: "ESC-регулятор Hobbywing Justock 120A", price: 5400, category: "Автомодели", subcategory: "Электро", city: "Сочи", delivery: ["СДЭК"], deliveryDetails: "Готов к встрече в Сочи, по России — СДЭК.", condition: "Б/у — отлично", status: "Куплю", contact: "tg @racer_sochi", authorId: "u7", description: "Куплю Hobbywing Justock 120A или аналог. Рассмотрю варианты от 4500₽ при хорошем состоянии.", views: 540, likes: 4, createdAt: "2 дня назад", seeds: [16, 161, 162], sellerStats: [4.6, 12, "сентябрь 2023"] },
  { id: "a7", title: "Сервопривод Savox SC-1256TG (титан)", price: 4900, category: "Запчасти", subcategory: "Моторы", city: "Новосибирск", delivery: ["Wildberries", "СДЭК"], deliveryDetails: "Отправка в течение 1–2 рабочих дней.", condition: "Новое", status: "Продаю", contact: "+7 900 000-00-07", authorId: "u4", description: "Savox SC-1256TG, 20 кг·см при 6В, 0.15 сек/60°, титановые шестерни. Новый, в заводской коробке.", views: 980, likes: 14, createdAt: "3 дня назад", seeds: [17, 171, 172, 173], sellerStats: [4.9, 64, "февраль 2022"] },
  { id: "a8", title: "Комплект декалей для Як-54 (масштаб 1:6)", price: 6700, category: "Самолёты", subcategory: "Пилотажки", city: "Ростов-на-Дону", delivery: ["СДЭК", "Почта России"], deliveryDetails: "Отправка в тубусе, аккуратная упаковка.", condition: "Новое", status: "Обменяю", contact: "tg @yak_pilot", authorId: "u8", description: "Полный комплект декалей для Як-54 1:6 советской раскраски. Готов обменять на исправный сервопривод HV или сложить с доплатой.", views: 320, likes: 6, createdAt: "3 дня назад", seeds: [18, 181, 182], sellerStats: [4.8, 18, "январь 2023"] },
  { id: "a9", title: "Корпус катера 1:20 из стеклопластика", price: 8500, category: "Корабли", subcategory: "Катера", city: "Екатеринбург", delivery: ["СДЭК"], deliveryDetails: "Крупногабарит — только СДЭК с дополнительной упаковкой.", condition: "Новое", status: "Продаю", contact: "+7 900 000-00-09", authorId: "u5", description: "Корпус глиссера 1:20, ручная формовка, стеклопластик 1.5мм. Без отделки, под покраску. Длина 600мм.", views: 410, likes: 9, createdAt: "4 дня назад", seeds: [19, 191, 192, 193], sellerStats: [4.7, 23, "октябрь 2022"] },
  { id: "a10", title: "Набор винтов APC 11x5.5E (5 пар)", price: 1200, category: "Запчасти", subcategory: "Моторы", city: "Краснодар", delivery: ["Почта России", "Ozon"], deliveryDetails: "Отправка Почтой 1 класса.", condition: "Новое", status: "Продаю", contact: "+7 900 000-00-10", authorId: "u1", description: "Электро-винты APC 11x5.5E, 5 пар. Балансировка с завода. Подходят для самолётов класса 1м.", views: 280, likes: 5, createdAt: "5 дней назад", seeds: [20, 201, 202], sellerStats: [4.9, 47, "март 2022"] },
  { id: "a11", title: "Шасси Mugen MBX8 ECO для багги 1:8", price: 24000, category: "Автомодели", subcategory: "Запчасти", city: "Краснодар", delivery: ["СДЭК"], deliveryDetails: "Самовывоз или СДЭК с осмотром при получении.", condition: "Б/у — хорошо", status: "Продаю", contact: "+7 900 000-00-11", authorId: "u1", description: "Полное шасси Mugen MBX8 ECO без электроники. Амортизаторы перебраны, новые масла. Подвеска без люфтов.", views: 1820, likes: 41, createdAt: "5 дней назад", seeds: [31, 311, 312, 313, 314], sellerStats: [4.9, 47, "март 2022"] },
  { id: "a12", title: "Мотор Castle 1717 Sensored 1650KV", price: 11500, category: "Автомодели", subcategory: "Электро", city: "Москва", delivery: ["СДЭК", "Яндекс Доставка"], deliveryDetails: "Москва — курьер, регионы — СДЭК.", condition: "Б/у — отлично", status: "Продаю", contact: "+7 900 000-00-12", authorId: "u2", description: "Castle Creations 1717 1650KV сенсорный. Откатан 3 сезона дрэга, состояние идеальное. С датчиком температуры.", views: 1240, likes: 27, createdAt: "неделю назад", seeds: [32, 321, 322, 323], sellerStats: [4.8, 32, "июль 2021"] },
  { id: "a13", title: "FPV-камера Caddx Ratel 2 V2", price: 3400, category: "Квадрокоптеры", subcategory: "FPV", city: "Санкт-Петербург", delivery: ["СДЭК", "Почта России"], deliveryDetails: "Отправка на следующий день.", condition: "Новое", status: "Продаю", contact: "tg @rc_spb", authorId: "u3", description: "Caddx Ratel 2 V2, 1200TVL, объектив 2.1мм, FOV 165°. Новая в блистере.", views: 980, likes: 15, createdAt: "неделю назад", seeds: [33, 331, 332], sellerStats: [5.0, 89, "ноябрь 2020"] },
  { id: "a14", title: "VTX TBS Unify Pro32 HV 5G8", price: 4200, category: "Квадрокоптеры", subcategory: "FPV", city: "Казань", delivery: ["Почта России"], deliveryDetails: "Только Почта, отслеживание включено.", condition: "Б/у — отлично", status: "Продаю", contact: "+7 900 000-00-14", authorId: "u6", description: "TBS Unify Pro32 HV, 25/200/500/800мВт. SmartAudio, MMCX. Без сколов, протестирован на стенде.", views: 670, likes: 11, createdAt: "неделю назад", seeds: [34, 341, 342], sellerStats: [4.7, 21, "май 2023"] },
  { id: "a15", title: "Полётный контроллер Holybro Kakute H7", price: 6800, category: "Электроника", subcategory: "Контроллеры", city: "Казань", delivery: ["СДЭК"], deliveryDetails: "Отправка в антистатическом пакете.", condition: "Новое", status: "Продаю", contact: "+7 900 000-00-15", authorId: "u6", description: "Holybro Kakute H7, H743, Betaflight 4.5. Новый, в комплекте провода и крепёж.", views: 1120, likes: 19, createdAt: "10 дней назад", seeds: [35, 351, 352, 353], sellerStats: [4.7, 21, "май 2023"] },
  { id: "a16", title: "Зарядное iCharger X8 1100W", price: 18500, category: "Аккумуляторы", subcategory: "LiPo", city: "Москва", delivery: ["СДЭК", "Ozon"], deliveryDetails: "Полный комплект: ЗУ, провода, балансировочные адаптеры.", condition: "Б/у — отлично", status: "Продаю", contact: "+7 900 000-00-16", authorId: "u2", description: "Junsi iCharger X8, 1100Вт, 30А. Прошивка последняя. Использовалось редко, состояние топ.", views: 1450, likes: 28, createdAt: "10 дней назад", seeds: [36, 361, 362, 363], sellerStats: [4.8, 32, "июль 2021"] },
  { id: "a17", title: "Аккумулятор LiPo 4S 2200mAh 75C", price: 1900, category: "Аккумуляторы", subcategory: "LiPo", city: "Краснодар", delivery: ["Почта России", "СДЭК"], deliveryDetails: "Только наземная отправка.", condition: "Новое", status: "Продаю", contact: "+7 900 000-00-17", authorId: "u1", description: "Новый CNHL Black Series 4S 2200mAh 75C, разъём XT60. В фабричной упаковке.", views: 540, likes: 8, createdAt: "10 дней назад", seeds: [37, 371, 372], sellerStats: [4.9, 47, "март 2022"] },
  { id: "a18", title: "Передатчик FrSky R-XSR (ACCST D16)", price: 1800, category: "Радиоаппаратура", subcategory: "Приёмники", city: "Новосибирск", delivery: ["Почта России"], deliveryDetails: "Отправка по предоплате.", condition: "Б/у — отлично", status: "Продаю", contact: "+7 900 000-00-18", authorId: "u4", description: "FrSky R-XSR, прошит на последнюю версию ACCST. Антенны без повреждений.", views: 460, likes: 6, createdAt: "2 недели назад", seeds: [38, 381], sellerStats: [4.9, 64, "февраль 2022"] },
  { id: "a19", title: "Сервотестер + контроллер серво Hitec", price: 1500, category: "Электроника", subcategory: "Датчики", city: "Сочи", delivery: ["СДЭК"], deliveryDetails: "Доставка только СДЭК.", condition: "Новое", status: "Продаю", contact: "tg @racer_sochi", authorId: "u7", description: "Многофункциональный сервотестер с дисплеем. Может работать как джиро-тест.", views: 280, likes: 3, createdAt: "2 недели назад", seeds: [39, 391, 392], sellerStats: [4.6, 12, "сентябрь 2023"] },
  { id: "a20", title: "Двигатель O.S. Speed B2103 для багги 1:8", price: 26000, category: "Автомодели", subcategory: "ДВС", city: "Москва", delivery: ["СДЭК"], deliveryDetails: "Только СДЭК. Готов выслать видео работы двигателя.", condition: "Б/у — отлично", status: "Продаю", contact: "+7 900 000-00-20", authorId: "u2", description: "O.S. Speed B2103 Type-S, 2 бака после капремонта (новые ГПП). Свеча новая. Полная диагностика прилагается.", views: 2340, likes: 52, createdAt: "2 недели назад", seeds: [40, 401, 402, 403, 404], sellerStats: [4.8, 32, "июль 2021"] },
  { id: "a21", title: "Краски Tamiya спрей TS — набор 8 цветов", price: 3600, category: "Запчасти", subcategory: "Шасси", city: "Екатеринбург", delivery: ["СДЭК", "Ozon"], deliveryDetails: "Аккуратная упаковка, отправка наземкой.", condition: "Новое", status: "Продаю", contact: "+7 900 000-00-21", authorId: "u5", description: "Набор спрей-красок Tamiya для лексана: TS-13 (лак), TS-49 (синий), TS-26, TS-86, TS-44 и др. 8 баллончиков по 100мл.", views: 720, likes: 12, createdAt: "3 недели назад", seeds: [41, 411, 412], sellerStats: [4.7, 23, "октябрь 2022"] },
  { id: "a22", title: "Кузов Pro-Line Chevy SS 1:10 короткий", price: 2400, category: "Автомодели", subcategory: "Запчасти", city: "Краснодар", delivery: ["Почта России", "СДЭК"], deliveryDetails: "Кузов чистый, под покраску.", condition: "Новое", status: "Продаю", contact: "+7 900 000-00-22", authorId: "u1", description: "Pro-Line Chevy SS для туринга 1:10, 190мм. Прозрачный, не тонирован, под покраску.", views: 380, likes: 7, createdAt: "3 недели назад", seeds: [42, 421, 422], sellerStats: [4.9, 47, "март 2022"] },
  { id: "a23", title: "Полётный комплект Pixhawk 6C Mini", price: 28000, category: "Разработчики", subcategory: "Автопилоты", city: "Ростов-на-Дону", delivery: ["СДЭК"], deliveryDetails: "Комплект: автопилот, GPS, PM, провода.", condition: "Новое", status: "Продаю", contact: "tg @pixhawk_rnd", authorId: "u8", description: "Holybro Pixhawk 6C Mini полный комплект. ArduPilot/PX4. Новый, не использовался.", views: 1620, likes: 31, createdAt: "3 недели назад", seeds: [43, 431, 432, 433], sellerStats: [4.8, 18, "январь 2023"] },
  { id: "a24", title: "Гироскоп MEMS BMI088 модуль", price: 850, category: "Электроника", subcategory: "Датчики", city: "Казань", delivery: ["Почта России"], deliveryDetails: "Отправка письмом 1 класса.", condition: "Новое", status: "Продаю", contact: "+7 900 000-00-24", authorId: "u6", description: "Модуль IMU на BMI088. SPI/I2C, 3.3В логика. В наличии 12 шт.", views: 240, likes: 2, createdAt: "месяц назад", seeds: [44, 441], sellerStats: [4.7, 21, "май 2023"] },
  { id: "a25", title: "Контроллер для электросамоката 60V 30A", price: 4500, category: "Электросамокаты", subcategory: "Контроллеры", city: "Сочи", delivery: ["СДЭК"], deliveryDetails: "С прошивкой под Kugoo/Dualtron.", condition: "Б/у — отлично", status: "Обменяю", contact: "tg @scooter_sochi", authorId: "u7", description: "Контроллер 60V 30A с FOC, прошивка кастомная. Меняю на батарею 60V не менее 25Ah.", views: 680, likes: 11, createdAt: "месяц назад", seeds: [45, 451, 452], sellerStats: [4.6, 12, "сентябрь 2023"] },
  { id: "a26", title: "Парусник Yacht Class 1м (RTR)", price: 14000, category: "Корабли", subcategory: "Парусники", city: "Екатеринбург", delivery: ["СДЭК"], deliveryDetails: "Крупногабарит, дополнительная защита корпуса.", condition: "Б/у — отлично", status: "Продаю", contact: "+7 900 000-00-26", authorId: "u5", description: "Парусная яхта класса 1м, готова к ходу. В комплекте 2 паруса, передатчик, ЗУ.", views: 320, likes: 5, createdAt: "месяц назад", seeds: [46, 461, 462, 463], sellerStats: [4.7, 23, "октябрь 2022"] },
  { id: "a27", title: "Набор инструмента Arrowmax 1:8 Touring", price: 7800, category: "Запчасти", subcategory: "Шасси", city: "Москва", delivery: ["СДЭК", "Ozon"], deliveryDetails: "Полный комплект в кейсе.", condition: "Новое", status: "Продаю", contact: "+7 900 000-00-27", authorId: "u2", description: "Arrowmax Honeycomb Tool Set для туринга и багги: шестигранники 1.5/2.0/2.5/3.0мм, плоские отвёртки, ключи. В алюминиевом кейсе.", views: 920, likes: 18, createdAt: "месяц назад", seeds: [47, 471, 472, 473], sellerStats: [4.8, 32, "июль 2021"] },
  { id: "a28", title: "Аэродинамический пакет для туринга 1:10", price: 2100, category: "Автомодели", subcategory: "Тюнинг", city: "Санкт-Петербург", delivery: ["Почта России"], deliveryDetails: "Лёгкая отправка письмом.", condition: "Новое", status: "Продаю", contact: "tg @rc_spb", authorId: "u3", description: "Прижимной обвес + сплиттер из лексана. Универсальная установка на туринг 190мм.", views: 410, likes: 7, createdAt: "месяц назад", seeds: [48, 481], sellerStats: [5.0, 89, "ноябрь 2020"] },
  { id: "a29", title: "Дрон DJI Avata комбо (Goggles 2 + RC Motion 2)", price: 95000, category: "Квадрокоптеры", subcategory: "Съёмочные", city: "Москва", delivery: ["СДЭК", "Яндекс Доставка"], deliveryDetails: "Полная коробка, чек сохранён, гарантия.", condition: "Б/у — отлично", status: "Продаю", contact: "+7 900 000-00-29", authorId: "u2", description: "DJI Avata комбо: дрон, очки Goggles 2, RC Motion 2, 3 батареи, чарджер. Налёт ~6 часов.", views: 4820, likes: 87, createdAt: "месяц назад", seeds: [49, 491, 492, 493, 494], sellerStats: [4.8, 32, "июль 2021"] },
  { id: "a30", title: "Планер EasyGlider 4 с электроприводом", price: 12500, category: "Самолёты", subcategory: "Планеры", city: "Новосибирск", delivery: ["СДЭК"], deliveryDetails: "Только СДЭК, большая коробка.", condition: "Б/у — отлично", status: "Продаю", contact: "+7 900 000-00-30", authorId: "u4", description: "Multiplex EasyGlider 4, размах 1.8м, мотор и регулятор установлены. Без электроники RX.", views: 760, likes: 13, createdAt: "2 месяца назад", seeds: [50, 501, 502], sellerStats: [4.9, 64, "февраль 2022"] },
];

export const ads: Ad[] = rawAds.map((r) => {
  const { seeds, sellerStats, ...rest } = r;
  const gallery = gal(seeds, rest.category);
  return {
    ...rest,
    image: gallery[0],
    gallery,
    seller: makeSeller(r.authorId, sellerStats[0], sellerStats[1], sellerStats[2]),
  };
});

export const adById = (id: ID) => ads.find((a) => a.id === id);

export const banners: Banner[] = [
  { id: "b1", title: "Гонки RC в Краснодаре", text: "Открыта регистрация на летний этап. Заявки принимаются до 20 июня — успейте занять место в гриде.", cta: "Записаться", until: "до 20.06", color: "from-red-700 to-slate-900", image: photo(901), kind: "event", pinned: true, priority: 10, scheduleFrom: "2026-06-01", scheduleTo: "2026-06-20" },
  { id: "b2", title: "Новый завоз LiPo батарей", text: "Большой выбор аккумуляторов под любые задачи — от 2S до 6S, проверенные бренды.", cta: "Смотреть", until: "до 15.07", color: "from-slate-700 to-slate-900", image: photo(902), kind: "news", priority: 5, scheduleFrom: "2026-06-15", scheduleTo: "2026-07-15" },
  { id: "b3", title: "Слёт авиамоделистов", text: "Открытое поле, демо-полёты и swap-meet запчастей. Приходите со своими моделями.", cta: "Подробнее", until: "до 12.07", color: "from-red-600 to-red-800", image: photo(903), kind: "event", priority: 3, scheduleFrom: "2026-07-01", scheduleTo: "2026-07-12" },
];

export const tariffs: Tariff[] = [
  
  { id: "t1", name: "Месяц", price: 100, period: "30 дней", features: ["Все разделы", "Чаты", "Объявления", "Поддержка"] },
  { id: "t2", name: "Полгода", price: 500, period: "180 дней", features: ["Всё из «Месяц»", "Приоритет в ленте", "Скидки в магазине"], popular: true },
  { id: "t3", name: "Год", price: 800, period: "365 дней", features: ["Всё из «Полгода»", "Бесплатные объявления", "Бейдж Pro"] },
];

export const communities: Community[] = [
  { id: "g1", name: "RC Авто Краснодар", description: "Клуб любителей RC-автомоделей: еженедельные заезды, обмен опытом, школа для новичков.", fullDescription: "Клуб RC-авто Краснодара объединяет более 400 моделистов. Мы проводим еженедельные тренировочные заезды на специально подготовленной трассе, помогаем новичкам с выбором первой модели, организуем городские чемпионаты и совместные закупки запчастей у проверенных поставщиков.", members: 412, category: "Автомодели", joined: true, avatarIcon: "Car", adminId: "u1", postIds: ["p1","p4"], coverImage: photo(301), avatarImage: photo(401), contacts: { website: "https://rc-krd.ru", phone: "+7 861 000-00-00" }, allowSubmitPost: true },
  { id: "g2", name: "Школа авиамоделизма", description: "Кружок и школа для детей и взрослых. От первой модели до соревнований.", fullDescription: "Школа авиамоделизма работает с 1998 года. Курсы для детей от 10 лет и взрослых: сборка планеров, пилотажек, реактивных моделей. Опытные инструкторы, оборудованная мастерская, выезды на полётное поле.", members: 1180, category: "Самолёты", avatarIcon: "Plane", adminId: "u4", postIds: ["p3"], coverImage: photo(302), avatarImage: photo(402), contacts: { phone: "+7 383 000-00-00" }, allowSubmitPost: true },
  { id: "g3", name: "FPV Академия", description: "Школа FPV-полётов и гонок. Симулятор, теория, реальные заезды.", fullDescription: "FPV Академия — это полный курс подготовки пилотов FPV-дронов. Теория, симулятор, сборка собственной рамы, настройка Betaflight, реальные полёты на закрытой площадке под руководством опытных инструкторов.", members: 2210, category: "Квадрокоптеры", avatarIcon: "Send", adminId: "u3", postIds: ["p2"], coverImage: photo(303), avatarImage: photo(403), contacts: { website: "https://fpv-academy.ru" }, allowSubmitPost: true },
  { id: "g4", name: "Клуб разработчиков автопилотов", description: "Сообщество инженеров: ArduPilot, PX4, кастомные платы.", fullDescription: "Закрытый профессиональный клуб для инженеров и разработчиков систем автоматического управления БПЛА. Обмен опытом, совместные проекты, доступ к закрытым воркшопам и митапам.", members: 320, category: "Разработчики", avatarIcon: "Code2", adminId: "u8", postIds: [], coverImage: photo(304), avatarImage: photo(404), contacts: {}, allowSubmitPost: false },
  { id: "g5", name: "Магазин запчастей «Модель»", description: "Официальный канал магазина: новинки, акции, обзоры.", fullDescription: "«Модель» — крупнейший магазин запчастей для RC-техники в России. На нашем канале — анонсы поступлений, обзоры новинок, акции, спецпредложения для подписчиков и ответы на технические вопросы.", members: 1640, category: "Запчасти", avatarIcon: "Wrench", adminId: "u2", postIds: [], coverImage: photo(305), avatarImage: photo(405), contacts: { website: "https://model-shop.ru", phone: "+7 800 000-00-00" }, allowSubmitPost: false },
  { id: "g6", name: "Кружок судомоделистов", description: "Клуб судомоделизма: катера, парусники, соревнования.", fullDescription: "Один из старейших кружков судомоделизма в России. Проводим занятия по постройке катеров и парусников, организуем региональные соревнования, помогаем с реставрацией исторических моделей.", members: 540, category: "Корабли", avatarIcon: "Ship", adminId: "u5", postIds: [], coverImage: photo(306), avatarImage: photo(406), contacts: { phone: "+7 343 000-00-00" }, allowSubmitPost: true },
  { id: "g7", name: "DIY Электроника", description: "Сообщество DIY-инженеров: ESC, телеметрия, прошивки.", fullDescription: "Сообщество для тех, кто любит паять и проектировать электронику для RC-моделей. Совместные проекты, разбор схем, обзоры компонентов, помощь в отладке.", members: 890, category: "Электроника", avatarIcon: "Cpu", adminId: "u6", postIds: ["p5"], coverImage: photo(307), avatarImage: photo(407), contacts: { website: "https://diy-rc.ru" }, allowSubmitPost: true },
  { id: "g8", name: "Школа батарей", description: "Обучение работе с LiPo, Li-ion, NiMH: эксплуатация и безопасность.", fullDescription: "Образовательный канал по аккумуляторам: подбор, эксплуатация, безопасность, утилизация. Видеоуроки, чек-листы, обзоры зарядных устройств.", members: 670, category: "Аккумуляторы", avatarIcon: "BatteryCharging", adminId: "u2", postIds: [], coverImage: photo(308), avatarImage: photo(408), contacts: {}, allowSubmitPost: false },
];

export const mockVideoCategories: VideoCategory[] = [
  { id: "vc-avia",   name: "Авиация",          slug: "aviaciya" },
  { id: "vc-auto",   name: "Автомодели",       slug: "avtomodeli" },
  { id: "vc-kvadro", name: "Квадрокоптеры",    slug: "kvadrokoptery" },
  { id: "vc-korabli",name: "Корабли",          slug: "korabli" },
  { id: "vc-radio",  name: "Радиоаппаратура",  slug: "radioapparatura" },
  { id: "vc-elektro",name: "Электроника",      slug: "elektronika" },
];

const DEMO_VIDEO_SRC = "/videos/demo-review-sample.mp4"; // bundled in Task 3

// Deterministic seeded catalog. All videoUrl point at the one bundled sample.
// publishedAt staggered (newest first is visibly meaningful). Several featured.
export const mockVideos: Video[] = [
  { id: "v1", title: "Первый полёт FPV-крыла: настройка и тримминг", description: "Полный разбор сборки и первого запуска FPV-крыла, настройка аппаратуры и полётного контроллера.", categoryId: "vc-avia", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 754, views: 12480, isFeatured: true, tags: ["FPV", "крыло", "настройка"], publishedAt: "2026-07-08T10:00:00Z", uploaderId: "u1", status: "published", likes: 342, comments: 2, commentList: [
    cmt("vc1", "u2", "1 ч назад", "Отличная настройка тримминга! Какой приёмник используешь?", 4),
    cmt("vc2", "u3", "40 мин назад", "Давно искал такой разбор, спасибо!", 1),
  ] },
  { id: "v2", title: "Багги 1:8 ДВС — обкатка нового мотора Picco", description: "Обкатываем свежий мотор, замеряем температуру, подбираем иглы карбюратора.", categoryId: "vc-auto", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 1263, views: 8320, isFeatured: true, tags: ["багги", "ДВС", "обкатка"], publishedAt: "2026-07-07T14:30:00Z", uploaderId: "u2", status: "published", likes: 210, comments: 1, commentList: [
    cmt("vc3", "u4", "2 ч назад", "Какие иглы в итоге подошли лучше?", 2),
  ] },
  { id: "v3", title: "Квадрокоптер 5\" фристайл — сборка с нуля", description: "Собираем фристайл-квадрик, паяем, прошиваем Betaflight.", categoryId: "vc-kvadro", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 2105, views: 21050, isFeatured: true, tags: ["квадрокоптер", "фристайл", "Betaflight"], publishedAt: "2026-07-06T09:15:00Z", uploaderId: "u3", status: "published", likes: 560, comments: 3, commentList: [
    cmt("vc4", "u5", "5 ч назад", "Какие настройки PID использовал в итоге?", 6),
    cmt("vc5", "u6", "3 ч назад", "Крутая сборка, повторю себе такую же", 2),
    cmt("vc6", "u7", "1 ч назад", "А рама какая? Ссылку скинь", 0),
  ] },
  { id: "v4", title: "RC-катер из стеклопластика — первый спуск на воду", description: "Ходовые испытания самодельного катера на пруду.", categoryId: "vc-korabli", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 489, views: 5410, isFeatured: false, tags: ["катер", "стеклопластик"], publishedAt: "2026-07-05T18:00:00Z", uploaderId: "u5", status: "published", likes: 98, comments: 0 },
  { id: "v5", title: "Обзор аппаратуры RadioMaster TX16S MKII", description: "Разбираем флагманский пульт, прошивка EdgeTX, модуль ELRS.", categoryId: "vc-radio", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 933, views: 15600, isFeatured: false, tags: ["аппаратура", "EdgeTX", "ELRS"], publishedAt: "2026-07-04T11:00:00Z", uploaderId: "u4", status: "published", likes: 401, comments: 0 },
  { id: "v6", title: "Пайка ESC и настройка регулятора Hobbywing", description: "Аккуратная пайка силовых проводов и калибровка регулятора.", categoryId: "vc-elektro", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 671, views: 7230, isFeatured: false, tags: ["ESC", "пайка", "Hobbywing"], publishedAt: "2026-07-03T16:45:00Z", uploaderId: "u7", status: "published", likes: 156, comments: 0 },
  { id: "v7", title: "Пилотаж на самолёте 3D — базовые фигуры", description: "Учимся крутить харрикейн и торк-роллы на пилотажке.", categoryId: "vc-avia", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 1420, views: 9840, isFeatured: false, tags: ["самолёт", "3D", "пилотаж"], publishedAt: "2026-07-02T12:20:00Z", uploaderId: "u8", status: "published", likes: 233, comments: 0 },
  { id: "v8", title: "Тюнинг подвески туринга 1:10", description: "Настройка развала, клиренса и жёсткости для асфальта.", categoryId: "vc-auto", posterUrl: "", videoUrl: DEMO_VIDEO_SRC, durationSeconds: 812, views: 6120, isFeatured: false, tags: ["туринг", "подвеска", "тюнинг"], publishedAt: "2026-07-01T08:00:00Z", uploaderId: "u4", status: "published", likes: 187, comments: 0 },
];

const _ago = (minutes: number): string =>
  new Date(Date.now() - minutes * 60 * 1000).toISOString();

export const dialogs: Dialog[] = [
  {
    id: "d1", userId: "u2", lastMessage: "Да, конечно! Скину схему вечером", time: _ago(5), unread: 2,
    messages: [
      { id: "d1m1", authorId: "u1", time: _ago(120), text: "Привет! Ты разбираешься в настройке карбюратора на OS Speed?", status: "read" },
      { id: "d1m2", authorId: "u2", time: _ago(118), text: "Привет! Да, конечно. Какой именно? У меня их три штуки на разных моторах стоят.", status: "read" },
      { id: "d1m3", authorId: "u1", time: _ago(115), text: "OS Speed 21XZ-B Spec II. Никак не могу поймать устойчивый холостой ход.", status: "read" },
      { id: "d1m4", authorId: "u2", time: _ago(110), text: "С этим мотором главное — игла холостого хода. Выставь зазор 0.7 мм, потом крути низ по температуре.", status: "read" },
      { id: "d1m5", authorId: "u1", time: _ago(100), text: "А свечу какую посоветуешь?", status: "read" },
      { id: "d1m6", authorId: "u2", time: _ago(90), text: "OS A5 средняя. На нитро 25% — идеально. У меня на такой же связке температура головы 105-115°C.", status: "read" },
      { id: "d1m6b", authorId: "u2", time: _ago(88), text: "", status: "read", voice: { duration: 13, waveform: makeMockWaveform(6142), transcript: "И ещё: после прогрева проверь компрессию рукой — если поршень легко проходит верхнюю точку, значит гильза подсела, пора менять." } },
      { id: "d1m7", authorId: "u1", time: _ago(15), text: "Спасибо, попробую! А можешь скинуть свою схему настройки?", status: "read" },
      { id: "d1m8", authorId: "u2", time: _ago(5), text: "Да, конечно! Скину схему вечером", status: "delivered", replyTo: "d1m7" },
    ],
  },
  {
    id: "d2", userId: "u3", lastMessage: "Сегодня в 18:00 на обычном месте", time: _ago(30), unread: 1,
    messages: [
      { id: "d2m1", authorId: "u3", time: _ago(180), text: "Готовим ночную гонку FPV! Будет трасса с LED-воротами.", status: "read" },
      { id: "d2m2", authorId: "u1", time: _ago(170), text: "Ого, звучит круто! Когда и где?", status: "read" },
      { id: "d2m3", authorId: "u3", time: _ago(160), text: "Суббота, 20:00. За городом, скину координаты.", status: "read" },
      { id: "d2m4", authorId: "u3", time: _ago(150), text: "Можешь взять свой 5-дюймовик и запасные пропеллеры?", status: "read" },
      { id: "d2m5", authorId: "u1", time: _ago(60), text: "Да, без проблем. А что по частотам? 5.8?", status: "read" },
      { id: "d2m6", authorId: "u3", time: _ago(30), text: "Сегодня в 18:00 на обычном месте", status: "delivered" },
    ],
  },
  {
    id: "d3", userId: "u4", lastMessage: "Напишу как получу посылку!", time: _ago(120), unread: 0,
    messages: [
      { id: "d3m1", authorId: "u4", time: _ago(1440), text: "Привет! Ты говорил, что у тебя есть декали на Як-52?", status: "read" },
      { id: "d3m2", authorId: "u1", time: _ago(1430), text: "Да, есть комплект в масштабе 1:6. Оригинальные советские.", status: "read" },
      { id: "d3m3", authorId: "u4", time: _ago(1400), text: "Отлично! Мне как раз такие нужны. Сколько хочешь?", status: "read" },
      { id: "d3m4", authorId: "u1", time: _ago(1380), text: "Да забирай так. Всё равно лежат без дела. Я вышлю почтой.", status: "read" },
      { id: "d3m5", authorId: "u4", time: _ago(160), text: "Спасибо огромное! Адрес в личных данных. Жду!", status: "read" },
      { id: "d3m6", authorId: "u1", time: _ago(120), text: "Отправил сегодня утром. Трек-номер: RU123456789", status: "read" },
      { id: "d3m7", authorId: "u4", time: _ago(115), text: "Супер! Буду ждать. Ещё раз спасибо!", status: "read" },
      { id: "d3m8", authorId: "u4", time: _ago(110), text: "Напишу как получу посылку!", status: "read" },
    ],
  },
  {
    id: "d4", userId: "u6", lastMessage: "Готово! Проверил — всё работает", time: _ago(10), unread: 4,
    messages: [
      { id: "d4m1", authorId: "u6", time: _ago(300), text: "Слушай, можешь глянуть мою схему контроллера ESC на STM32?", status: "read" },
      { id: "d4m2", authorId: "u6", time: _ago(299), text: "Вот скриншот разводки платы", status: "read", image: photo(201) },
      { id: "d4m3", authorId: "u1", time: _ago(280), text: "Смотрю... А где у тебя защитный диод на входе питания?", status: "read", replyTo: "d4m2" },
      { id: "d4m4", authorId: "u6", time: _ago(270), text: "Точно! Забыл про него. Сейчас добавлю.", status: "read" },
      { id: "d4m5", authorId: "u6", time: _ago(250), text: "Кстати, какой конденсатор лучше поставить на выход?", status: "read" },
      { id: "d4m6", authorId: "u1", time: _ago(200), text: "Low ESR, 470 мкФ, 25V. Я обычно Nichicon ставлю.", status: "read" },
      { id: "d4m7", authorId: "u6", time: _ago(60), text: "Переделал плату с учётом замечаний. Глянешь ещё раз?", status: "read" },
      { id: "d4m8", authorId: "u6", time: _ago(55), text: "Вот обновлённая схема", status: "read", image: photo(202) },
      { id: "d4m9", authorId: "u1", time: _ago(20), text: "Теперь отлично! Защита есть, дорожки толстые. Можно заказывать.", status: "read" },
      { id: "d4m10", authorId: "u6", time: _ago(10), text: "Готово! Проверил — всё работает", status: "delivered" },
    ],
  },
  {
    id: "d5", userId: "u5", lastMessage: "Договорились! До встречи", time: _ago(1440), unread: 0,
    messages: [
      { id: "d5m1", authorId: "u5", time: _ago(3000), text: "Здорово! Увидел твой пост про багги. У меня тоже HB, только D817.", status: "read" },
      { id: "d5m2", authorId: "u1", time: _ago(2900), text: "Классная машина! Как тебе дифференциалы?", status: "read" },
      { id: "d5m3", authorId: "u5", time: _ago(2800), text: "Залил 100k спереди, 7k сзади. На ковре едет как по рельсам.", status: "read" },
      { id: "d5m4", authorId: "u1", time: _ago(1500), text: "Слушай, у меня как раз передние диффы под замену. Какие посоветуешь?", status: "read" },
      { id: "d5m5", authorId: "u5", time: _ago(1440), text: "Договорились! До встречи", status: "read" },
    ],
  },
  {
    id: "d6", userId: "u7", lastMessage: "Спасибо, всё понял!", time: _ago(2880), unread: 0,
    messages: [
      { id: "d6m1", authorId: "u7", time: _ago(4320), text: "Привет! Подскажи по прошивке контроллера самоката?", status: "read" },
      { id: "d6m2", authorId: "u1", time: _ago(4300), text: "Привет! А что именно интересует?", status: "read" },
      { id: "d6m3", authorId: "u7", time: _ago(4200), text: "Хочу увеличить максимальную скорость. Стандартная прошивка ограничивает 25 км/ч.", status: "read" },
      { id: "d6m4", authorId: "u1", time: _ago(4000), text: "Тут надо аккуратно. Во-первых, проверь версию контроллера. Во-вторых, прошей через ST-Link.", status: "read" },
      { id: "d6m5", authorId: "u7", time: _ago(2880), text: "Спасибо, всё понял!", status: "read" },
    ],
  },
  {
    id: "d7", userId: "u8", lastMessage: "Согласен! Завтра созвонимся", time: _ago(5760), unread: 0,
    messages: [
      { id: "d7m1", authorId: "u8", time: _ago(6000), text: "Привет! Я тут свой автопилот на STM32F4 делаю. Интересует совместная разработка?", status: "read" },
      { id: "d7m2", authorId: "u1", time: _ago(5900), text: "Очень интересно! А что за проект?", status: "read" },
      { id: "d7m3", authorId: "u8", time: _ago(5800), text: "Полётный контроллер с поддержкой ArduPilot. Свой дизайн платы, 6-слойка.", status: "read" },
      { id: "d7m4", authorId: "u8", time: _ago(5790), text: "Вот фото прототипа", status: "read", image: photo(203) },
      { id: "d7m5", authorId: "u1", time: _ago(5770), text: "Согласен! Завтра созвонимся", status: "read" },
    ],
  },
  {
    id: "d8", userId: "u4", lastMessage: "Отлично, жду!", time: _ago(10080), unread: 0,
    messages: [
      { id: "d8m1", authorId: "u1", time: _ago(10100), text: "Андрей, привет! Ты на гонки в субботу идёшь?", status: "read" },
      { id: "d8m2", authorId: "u4", time: _ago(10090), text: "Привет! Да, планирую. Буду со своим новым планером.", status: "read" },
      { id: "d8m3", authorId: "u1", time: _ago(10080), text: "Отлично, жду!", status: "read" },
    ],
  },
];

export const chatMessages: Message[] = [
  { id: "cm1", authorId: "u2", time: _ago(120), text: "Парни, кто гонял Picco на нитро 30%? Какие настройки иглы?", status: "read" },
  { id: "cm2", authorId: "u1", time: _ago(115), text: "У меня основная 2 щелчка от закрытия, холостая по факелу", status: "read" },
  { id: "cm3", authorId: "u4", time: _ago(110), text: "Главное — не перегреть. Следи за головой.", status: "read" },
  { id: "cm4", authorId: "u6", time: _ago(60), text: "Тоже хочу попробовать, продаю свой O.S.", status: "read" },
  { id: "cm5", authorId: "u3", time: _ago(30), text: "Видео обкатки скинете?", status: "read" },
];

// Runtime registry for users that arrive from the API (authors, sellers, chat
// peers, …). Lets components keep using userById() while real data flows in.
const dynamicUsers: Record<ID, User> = {};

export function registerUser(u: User): void {
  if (!u?.id) return;
  dynamicUsers[u.id] = { ...dynamicUsers[u.id], ...u };
}

// Resolves a user from the runtime registry (filled by API mappers via
// registerUser). Falls back to a neutral placeholder — never mock identities —
// so an unresolved author/peer shows as "Пользователь", not a fake person.
const placeholderUser = (id: ID): User => ({
  id,
  name: "Пользователь",
  city: "",
  interests: "",
  avatar: "",
});

export const userById = (id: ID): User =>
  dynamicUsers[id] ?? placeholderUser(id);
export const categoryById = (id: ID) => categories.find((c) => c.id === id);
export const communityById = (id: ID) => communities.find((c) => c.id === id);

export function formatRelativeTime(iso: string): string {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return iso;
  const diffMs = Date.now() - t;
  const min = Math.floor(diffMs / 60000);
  if (min < 1) return "только что";
  if (min < 60) return `${min} мин назад`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} ч назад`;
  const d = new Date(t);
  const days = Math.floor(h / 24);
  const pad = (n: number) => String(n).padStart(2, "0");
  if (days < 2) return `Вчера ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  if (days < 7) return `${days} дн назад`;
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()}`;
}


// ============= v6.0 additions =============

export interface SubscriptionPlan {
  id: string;
  name: string;
  price: number;
  periodLabel: string;
  savingsLabel?: string;
  isBestValue?: boolean;
  isPopular?: boolean;
  features: string[];
  accent?: boolean;
}

export interface FAQItem {
  id: string;
  category: "general" | "ads" | "payment" | "account" | "communities" | "moderation";
  question: string;
  answer: string;
}

export interface AdminStats {
  totalUsers: number;
  monthlyRevenue: number;
  activeAds: number;
  totalPosts: number;
  inModeration: number;
  newToday: number;
}

export interface AdminAction {
  id: string;
  user: string;
  action: string;
  target: string;
  time: string;
}

export interface AdminUser {
  id: string;
  name: string;
  avatar: string;
  email: string;
  city: string;
  subscription: string | null;
  role: "admin" | "moderator" | "user";
  status: "active" | "blocked";
  registeredAt: string;
}

export interface PromoCode {
  id: string;
  code: string;
  discount: number;
  usedCount: number;
  limit: number;
  expiresAt: string; // ISO date
  status?: "active" | "expired";
}

export const subscriptionPlans: SubscriptionPlan[] = [
  
  { id: "month", name: "Месяц", price: 100, periodLabel: "месяц", features: ["Всё из Тестового", "Безлимитные объявления", "Приоритет в ленте", "Поддержка 24/7"], accent: true },
  { id: "half", name: "Полгода", price: 500, periodLabel: "полгода", savingsLabel: "Экономия 100₽", isPopular: true, features: ["Всё из «Месяц»", "Скидки в магазине 10%", "Бейдж «МоДелизМ» в профиле", "Комиссия 0% на продажи"], accent: true },
  { id: "year", name: "Год", price: 800, periodLabel: "год", savingsLabel: "Экономия 400₽", isBestValue: true, features: ["Всё из «Полгода»", "3 бесплатных объявления/мес", "Бейдж «МоДелизМ Pro» в профиле", "Без рекламы на платформе", "Приоритетная поддержка"] },
];

export const faqItems: FAQItem[] = [
  { id: "f1", category: "general", question: "Что такое МоДелизМ?", answer: "Это социальная платформа для моделистов, где можно общаться, делиться проектами, продавать и покупать запчасти и модели." },
  { id: "f2", category: "general", question: "Как зарегистрироваться?", answer: "Нажмите «Регистрация» на главной, укажите имя, email и пароль. Подтвердите почту и заполните профиль." },
  { id: "f3", category: "general", question: "Нужна ли подписка?", answer: "Базовый доступ бесплатный. Для расширенных функций — подписка от 99 ₽ в месяц." },
  { id: "f4", category: "ads", question: "Как разместить объявление?", answer: "Нажмите «Создать» → «Объявление», заполните форму (название, цена, фото), оплатите 20 ₽ и ждите модерации." },
  { id: "f5", category: "ads", question: "Сколько стоит размещение?", answer: "20 ₽ за одно объявление. Подписчики «Год» получают 3 бесплатных размещения в месяц." },
  { id: "f6", category: "ads", question: "Как долго висит объявление?", answer: "30 дней. После этого можно продлить или снять с публикации." },
  { id: "f7", category: "payment", question: "Какие способы оплаты?", answer: "ЮKassa и Т-Банк. В production добавим также СБП и криптовалюту." },
  { id: "f8", category: "payment", question: "Можно ли вернуть деньги?", answer: "Да, в течение 24 часов после оплаты. Напишите в поддержку." },
  { id: "f9", category: "payment", question: "Что такое промокод?", answer: "Специальный код на скидку. Введите на странице подписки и нажмите «Применить»." },
  { id: "f10", category: "account", question: "Как изменить профиль?", answer: "Перейдите в Профиль → нажмите «Редактировать». Можно сменить аватар, имя, город, интересы." },
  { id: "f11", category: "account", question: "Как удалить аккаунт?", answer: "Напишите в поддержку с темой «Удаление аккаунта». Данные будут удалены в течение 7 дней." },
  { id: "f12", category: "account", question: "Что такое верификация?", answer: "Подтверждение личности для доступа к расширенным функциям. Загрузите фото документа в профиле." },
  { id: "f13", category: "communities", question: "Как создать сообщество?", answer: "В разделе «Сообщества» нажмите «Создать». Укажите название, описание, категорию." },
  { id: "f14", category: "communities", question: "Кто может вступить в сообщество?", answer: "Любой зарегистрированный пользователь. Администратор может ограничить доступ." },
  { id: "f15", category: "communities", question: "Как работают чаты подкатегорий?", answer: "В каждой подкатегории (например, «Масштаб 1:10») есть общий чат. Все сообщения видны участникам." },
  { id: "f16", category: "moderation", question: "Почему мой пост на модерации?", answer: "Все публикации проходят проверку. Обычно это занимает до 2 часов." },
  { id: "f17", category: "moderation", question: "Что нельзя публиковать?", answer: "Запрещены: спам, оскорбления, контент 18+, мошеннические объявления, политическая реклама." },
  { id: "f18", category: "moderation", question: "Как пожаловаться на нарушение?", answer: "Нажмите «Пожаловаться» на посте или объявлении. Модератор рассмотрит в течение 24 часов." },
];

export const faqCategories: { id: FAQItem["category"] | "all"; label: string }[] = [
  { id: "all", label: "Все" },
  { id: "general", label: "Общее" },
  { id: "ads", label: "Объявления" },
  { id: "payment", label: "Оплата" },
  { id: "account", label: "Аккаунт" },
  { id: "communities", label: "Сообщества" },
  { id: "moderation", label: "Модерация" },
];

export const adminStats: AdminStats = {
  totalUsers: 12480,
  monthlyRevenue: 384200,
  activeAds: 2156,
  totalPosts: 8742,
  inModeration: 34,
  newToday: 127,
};

export const adminActions: AdminAction[] = [
  { id: "a1", user: "Александр RC", action: "Опубликовал пост", target: "Новый двигатель OS Speed", time: "5 мин назад" },
  { id: "a2", user: "Сергей ДВС", action: "Разместил объявление", target: "Продам сервоприводы", time: "12 мин назад" },
  { id: "a3", user: "Модератор", action: "Одобрил объявление", target: "FPV-очки DJI", time: "28 мин назад" },
  { id: "a4", user: "Михаил Квадро", action: "Зарегистрировался", target: "—", time: "1 час назад" },
  { id: "a5", user: "Андрей Самолёты", action: "Обновил профиль", target: "—", time: "2 часа назад" },
  { id: "a6", user: "Модератор", action: "Отклонил пост", target: "Спам-пост #247", time: "3 часа назад" },
  { id: "a7", user: "Олег DIY", action: "Вступил в сообщество", target: "Электроника и DIY", time: "4 часа назад" },
  { id: "a8", user: "Дмитрий Моделист", action: "Оплатил подписку", target: "Тариф «Год»", time: "5 часов назад" },
];

const ava = (s: string) => `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(s)}&backgroundColor=c8102e,1f2937,374151,6b7280`;

export const adminUsers: AdminUser[] = [
  { id: "au1", name: "Александр Ракетов", avatar: ava("Александр Ракетов"), email: "alex@modelizm.ru", city: "Краснодар", subscription: "Год", role: "admin", status: "active", registeredAt: "12.03.2025" },
  { id: "au2", name: "Сергей Моторин", avatar: ava("Сергей Моторин"), email: "sergey@modelizm.ru", city: "Краснодар", subscription: "Месяц", role: "user", status: "active", registeredAt: "01.04.2025" },
  { id: "au3", name: "Михаил Летов", avatar: ava("Михаил Летов"), email: "mikhail@modelizm.ru", city: "Москва", subscription: "Полгода", role: "moderator", status: "active", registeredAt: "15.04.2025" },
  { id: "au4", name: "Андрей Крылов", avatar: ava("Андрей Крылов"), email: "andrey@modelizm.ru", city: "СПб", subscription: null, role: "user", status: "active", registeredAt: "20.04.2025" },
  { id: "au5", name: "Олег Паяльник", avatar: ava("Олег Паяльник"), email: "oleg@modelizm.ru", city: "Новосибирск", subscription: "Месяц", role: "user", status: "active", registeredAt: "05.05.2025" },
  { id: "au6", name: "Дмитрий Шасси", avatar: ava("Дмитрий Шасси"), email: "dima@modelizm.ru", city: "Краснодар", subscription: null, role: "user", status: "blocked", registeredAt: "10.05.2025" },
  { id: "au7", name: "Игорь Пропеллер", avatar: ava("Игорь Пропеллер"), email: "igor@modelizm.ru", city: "Екатеринбург", subscription: "Год", role: "user", status: "active", registeredAt: "12.05.2025" },
  { id: "au8", name: "Виктор Рулевой", avatar: ava("Виктор Рулевой"), email: "victor@modelizm.ru", city: "Казань", subscription: "Месяц", role: "user", status: "active", registeredAt: "01.06.2025" },
];

export const promoCodes: PromoCode[] = [
  { id: "pr1", code: "START2026", discount: 20, usedCount: 34, limit: 100, expiresAt: "2026-12-31", status: "active" },
  { id: "pr2", code: "MODELIZM", discount: 15, usedCount: 128, limit: 500, expiresAt: "2026-09-30", status: "active" },
  { id: "pr3", code: "HALFPRICE", discount: 50, usedCount: 5, limit: 20, expiresAt: "2026-03-01", status: "expired" },
];

export interface WalletOperation {
  id: string;
  type: "in" | "out";
  amount: number;
  title: string;
  date: string;
}

export const mockWalletBalance = 4250;

export const mockWalletOperations: WalletOperation[] = [
  { id: "w1", type: "in", amount: 1500, title: "Пополнение баланса", date: "2026-07-06T12:00:00Z" },
  { id: "w2", type: "out", amount: 490, title: "Продвижение объявления", date: "2026-07-05T09:30:00Z" },
  { id: "w3", type: "in", amount: 3200, title: "Продажа: RC багги HB Racing", date: "2026-07-02T16:45:00Z" },
  { id: "w4", type: "out", amount: 160, title: "Комиссия сервиса", date: "2026-07-02T16:45:00Z" },
];

export interface MyReview {
  id: string;
  author: string;
  avatar: string;
  rating: number;
  text: string;
  date: string;
}

export const mockMyRating = { average: 4.8, count: 27 };

export const mockMyReviews: MyReview[] = [
  { id: "r1", author: "Сергей ДВС", avatar: avatar("Сергей ДВС"), rating: 5, text: "Отличная сделка, багги в идеале. Всё честно, рекомендую!", date: "2026-07-04T10:00:00Z" },
  { id: "r2", author: "Михаил Квадро", avatar: avatar("Михаил Квадро"), rating: 5, text: "Быстро ответил, помог с настройкой. Спасибо!", date: "2026-06-28T14:20:00Z" },
  { id: "r3", author: "Дмитрий Моделист", avatar: avatar("Дмитрий Моделист"), rating: 4, text: "Хороший продавец, доставка чуть задержалась, но товар соответствует.", date: "2026-06-20T09:15:00Z" },
];
