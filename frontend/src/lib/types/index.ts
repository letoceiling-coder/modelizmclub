export type ID = string;

export interface UserProfile {
  slug: string;
  displayName: string;
  avatar?: string | null;
  city?: string;
  bio?: string;
  interests?: string;
  coverImage?: string;
  online?: boolean;
  status?: string;
  friendIds?: ID[];
  joinedDate?: string;
  subscription?: string | null;
  firstHundred?: boolean;
}

/** Profile view model used on profile/user pages */
export type User = UserProfile & { id?: ID };

export interface PostAuthor {
  slug: string;
  name: string;
  avatar?: string | null;
}

export interface Comment {
  id: ID;
  author: PostAuthor;
  time: string;
  text: string;
  likes?: number;
  replies?: Comment[];
}

export interface Post {
  id: ID;
  author: PostAuthor;
  date: string;
  category: string;
  categoryId?: number;
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
  repostedBy?: PostAuthor;
  commentList?: Comment[];
}

export interface Category {
  id: ID;
  name: string;
  description?: string;
  icon?: string;
  members?: number;
  slug?: string;
  subcategories?: { id: ID; name: string; slug?: string }[];
}

export interface Community {
  id: ID;
  dbId?: number;
  uuid?: string;
  name: string;
  description: string;
  fullDescription?: string;
  members: number;
  category: string;
  joined?: boolean;
  isOfficial?: boolean;
  avatarIcon?: string;
  coverImage?: string;
  avatarImage?: string;
  contacts?: CommunityContacts;
  allowSubmitPost?: boolean;
}

export interface Banner {
  id: ID;
  title: string;
  text?: string;
  linkUrl?: string;
  placement?: string;
}

export type AdCondition = "Новое" | "Б/у — отлично" | "Б/у — хорошо" | "Под восстановление";

export interface Listing {
  id: ID;
  title: string;
  price: number;
  category: string;
  subcategory?: string;
  city: string;
  image?: string;
  gallery?: string[];
  description?: string;
  delivery: string[];
  deliveryDetails?: string;
  condition?: AdCondition | string;
  status: string;
  contact?: string;
  author: PostAuthor;
  seller?: AdSeller;
  views?: number;
  likes?: number;
  createdAt?: string;
  moderation?: "published" | "moderation" | "rejected";
}

/** UI alias for marketplace listings */
export type Ad = Listing;

export interface AdSeller {
  slug: string;
  name: string;
  avatar?: string | null;
  rating?: number;
  deals?: number;
  since?: string;
}

export interface CommunityContacts {
  website?: string;
  phone?: string;
  telegram?: string;
}

export interface VoiceMessage {
  duration: number;
  waveform: number[];
  transcript: string;
}

export interface ChatMessage {
  id: ID;
  author: PostAuthor;
  time: string;
  text: string;
  type?: "text" | "voice";
  status?: "sent" | "delivered" | "read";
  replyTo?: { id: ID; text: string; authorName: string };
  image?: string;
  voice?: VoiceMessage;
}

/** @deprecated use ChatMessage */
export type Message = ChatMessage;

export interface Conversation {
  id: ID;
  title: string;
  type: string;
  lastMessage?: string;
  lastMessageAt?: string;
  participants: PostAuthor[];
  unread?: number;
}

export interface FaqCategory {
  id: ID;
  slug: string;
  name: string;
  articles: { id: ID; question: string; answer: string }[];
}

export interface SubscriptionPlan {
  slug: string;
  name: string;
  description?: string;
  priceCents: number;
  periodDays: number;
  features?: Record<string, unknown>;
}
