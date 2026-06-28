// SPA-internal single source of truth.
// State lives at module scope, so all mutations survive client-side navigation.
// Components subscribe via useSyncExternalStore and re-render on every change.

import { useMemo, useSyncExternalStore } from "react";
import type {
  User,
  Post,
  Ad,
  Dialog,
  Message,
  Community,
  FriendRequest,
  Comment,
  ID,
} from "./mock";

// Neutral placeholder used before the session is restored / when signed out.
// Carries no mock identity so nothing fake ever reaches the UI.
export const GUEST_USER: User = {
  id: "guest",
  name: "Гость",
  city: "",
  interests: "",
  avatar: "",
};

export type AdStatusKey =
  | "active"
  | "archived"
  | "moderation"
  | "rejected"
  | "deleted"
  | "draft"
  | "unpublished";

export interface Friendship {
  id: string;
  userId1: ID;
  userId2: ID;
  since: string;
}

export interface DialogMeta {
  archived: boolean;
  muted: boolean;
  blocked: boolean;
  mutedUntil?: string;
}

export interface AppState {
  users: Record<ID, User>;
  posts: Record<ID, Post>;
  ads: Record<ID, Ad>;
  adStatus: Record<ID, AdStatusKey>;
  dialogs: Record<ID, Dialog>;
  dialogMeta: Record<ID, DialogMeta>;
  communities: Record<ID, Community>;
  communityMemberships: Record<ID, ID[]>; // userId -> communityIds
  friendRequests: FriendRequest[];
  friendships: Friendship[];
  currentUserId: ID;
}

// The store starts empty and is hydrated exclusively from the API
// (session restore, feed/listing/chat mappers, friend hydration, …).
// Only a neutral guest user is present so `currentUser` is always defined.
export function createInitialState(): AppState {
  return {
    users: { [GUEST_USER.id]: GUEST_USER },
    posts: {},
    ads: {},
    adStatus: {},
    dialogs: {},
    dialogMeta: {},
    communities: {},
    communityMemberships: {},
    friendRequests: [],
    friendships: [],
    currentUserId: GUEST_USER.id,
  };
}

// ── store internals ──────────────────────────────────────────────
let state: AppState = createInitialState();
const listeners = new Set<() => void>();
const getSnapshot = (): AppState => state;
const subscribe = (l: () => void): (() => void) => {
  listeners.add(l);
  return () => {
    listeners.delete(l);
  };
};
const emit = (): void => {
  listeners.forEach((l) => l());
};

type Action =
  | { type: "ADD_MESSAGE"; dialogId: ID; message: Message }
  | { type: "MARK_READ"; dialogId: ID }
  | { type: "UPDATE_PROFILE"; userId: ID; data: Partial<User> }
  | { type: "SEND_FRIEND_REQUEST"; fromId: ID; toId: ID }
  | { type: "ACCEPT_FRIEND_REQUEST"; requestId: ID }
  | { type: "DECLINE_FRIEND_REQUEST"; requestId: ID }
  | { type: "REMOVE_FRIEND"; userId1: ID; userId2: ID }
  | { type: "JOIN_COMMUNITY"; userId: ID; communityId: ID }
  | { type: "LEAVE_COMMUNITY"; userId: ID; communityId: ID }
  | { type: "SET_AD_STATUS"; adId: ID; status: AdStatusKey }
  | { type: "CREATE_AD"; ad: Ad; status?: AdStatusKey }
  | { type: "CREATE_POST"; post: Post }
  | { type: "LIKE_POST"; postId: ID; like: boolean }
  | { type: "SAVE_POST"; postId: ID; save: boolean }
  | { type: "ADD_COMMENT"; postId: ID; comment: Comment }
  | { type: "SET_DIALOG_META"; dialogId: ID; patch: Partial<DialogMeta> }
  | { type: "SET_CURRENT_USER"; user: User }
  | { type: "SET_DIALOGS"; dialogs: Dialog[] }
  | { type: "SET_DIALOG_MESSAGES"; dialogId: ID; messages: Message[] };

function reducer(s: AppState, a: Action): AppState {
  switch (a.type) {
    case "ADD_MESSAGE": {
      const d = s.dialogs[a.dialogId];
      if (!d) return s;
      const preview = a.message.text
        ? a.message.text
        : a.message.voice
          ? "🎤 Голосовое сообщение"
          : a.message.image
            ? "📷 Изображение"
            : "";
      const nextDialog: Dialog = {
        ...d,
        messages: [...d.messages, a.message],
        lastMessage: preview,
        time: a.message.time,
      };
      return { ...s, dialogs: { ...s.dialogs, [a.dialogId]: nextDialog } };
    }
    case "MARK_READ": {
      const d = s.dialogs[a.dialogId];
      if (!d) return s;
      return { ...s, dialogs: { ...s.dialogs, [a.dialogId]: { ...d, unread: 0 } } };
    }
    case "UPDATE_PROFILE": {
      const u = s.users[a.userId];
      if (!u) return s;
      return { ...s, users: { ...s.users, [a.userId]: { ...u, ...a.data } } };
    }
    case "SEND_FRIEND_REQUEST": {
      const req: FriendRequest = {
        id: `fr_${Date.now()}`,
        fromId: a.fromId,
        toId: a.toId,
        status: "pending",
        date: new Date().toISOString(),
      };
      return { ...s, friendRequests: [...s.friendRequests, req] };
    }
    case "ACCEPT_FRIEND_REQUEST": {
      const req = s.friendRequests.find((r) => r.id === a.requestId);
      if (!req) return s;
      const key = [req.fromId, req.toId].sort().join("|");
      const fs: Friendship = {
        id: `fs_${key}`,
        userId1: req.fromId,
        userId2: req.toId,
        since: new Date().toISOString(),
      };
      return {
        ...s,
        friendRequests: s.friendRequests.filter((r) => r.id !== a.requestId),
        friendships: s.friendships.some((x) => x.id === fs.id) ? s.friendships : [...s.friendships, fs],
      };
    }
    case "DECLINE_FRIEND_REQUEST":
      return {
        ...s,
        friendRequests: s.friendRequests.filter((r) => r.id !== a.requestId),
      };
    case "REMOVE_FRIEND":
      return {
        ...s,
        friendships: s.friendships.filter(
          (f) =>
            !(
              (f.userId1 === a.userId1 && f.userId2 === a.userId2) ||
              (f.userId1 === a.userId2 && f.userId2 === a.userId1)
            ),
        ),
      };
    case "JOIN_COMMUNITY": {
      const current = s.communityMemberships[a.userId] ?? [];
      if (current.includes(a.communityId)) return s;
      const c = s.communities[a.communityId];
      return {
        ...s,
        communityMemberships: { ...s.communityMemberships, [a.userId]: [...current, a.communityId] },
        communities: c
          ? { ...s.communities, [a.communityId]: { ...c, members: c.members + 1, joined: true } }
          : s.communities,
      };
    }
    case "LEAVE_COMMUNITY": {
      const current = s.communityMemberships[a.userId] ?? [];
      const c = s.communities[a.communityId];
      return {
        ...s,
        communityMemberships: {
          ...s.communityMemberships,
          [a.userId]: current.filter((id) => id !== a.communityId),
        },
        communities: c
          ? {
              ...s.communities,
              [a.communityId]: { ...c, members: Math.max(0, c.members - 1), joined: false },
            }
          : s.communities,
      };
    }
    case "SET_AD_STATUS":
      return { ...s, adStatus: { ...s.adStatus, [a.adId]: a.status } };
    case "CREATE_AD":
      return {
        ...s,
        ads: { ...s.ads, [a.ad.id]: a.ad },
        adStatus: { ...s.adStatus, [a.ad.id]: a.status ?? "active" },
      };
    case "CREATE_POST":
      return { ...s, posts: { ...s.posts, [a.post.id]: a.post } };
    case "LIKE_POST": {
      const p = s.posts[a.postId];
      if (!p) return s;
      const delta = a.like ? 1 : -1;
      return {
        ...s,
        posts: {
          ...s.posts,
          [a.postId]: { ...p, isLiked: a.like, likes: Math.max(0, p.likes + delta) },
        },
      };
    }
    case "SAVE_POST": {
      const p = s.posts[a.postId];
      if (!p) return s;
      const delta = a.save ? 1 : -1;
      return {
        ...s,
        posts: {
          ...s.posts,
          [a.postId]: { ...p, isSaved: a.save, saves: Math.max(0, (p.saves ?? 0) + delta) },
        },
      };
    }
    case "ADD_COMMENT": {
      const p = s.posts[a.postId];
      if (!p) return s;
      return {
        ...s,
        posts: {
          ...s.posts,
          [a.postId]: {
            ...p,
            comments: p.comments + 1,
            commentList: [...(p.commentList ?? []), a.comment],
          },
        },
      };
    }
    case "SET_DIALOG_META": {
      const prev = s.dialogMeta[a.dialogId] ?? { archived: false, muted: false, blocked: false };
      return { ...s, dialogMeta: { ...s.dialogMeta, [a.dialogId]: { ...prev, ...a.patch } } };
    }
    case "SET_CURRENT_USER": {
      const existing = s.users[a.user.id];
      return {
        ...s,
        users: { ...s.users, [a.user.id]: { ...existing, ...a.user } },
        currentUserId: a.user.id,
      };
    }
    case "SET_DIALOGS": {
      const dialogs: Record<ID, Dialog> = {};
      for (const d of a.dialogs) {
        // Preserve already-loaded messages when refreshing the list.
        const prev = s.dialogs[d.id];
        dialogs[d.id] = prev ? { ...d, messages: prev.messages.length ? prev.messages : d.messages } : d;
      }
      return { ...s, dialogs };
    }
    case "SET_DIALOG_MESSAGES": {
      const d = s.dialogs[a.dialogId];
      if (!d) return s;
      return { ...s, dialogs: { ...s.dialogs, [a.dialogId]: { ...d, messages: a.messages } } };
    }
    default:
      return s;
  }
}

function dispatch(a: Action): void {
  const next = reducer(state, a);
  if (next !== state) {
    state = next;
    emit();
  }
}

export function useStore<T>(selector: (s: AppState) => T): T {
  // Subscribe to whole state (referentially stable — only changes on dispatch),
  // then derive via useMemo. Avoids infinite loops from selectors that build
  // new arrays/objects on every call.
  const snap = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  return useMemo(() => selector(snap), [snap, selector]);
}


export const actions = {
  addMessage: (dialogId: ID, message: Message) => dispatch({ type: "ADD_MESSAGE", dialogId, message }),
  markRead: (dialogId: ID) => dispatch({ type: "MARK_READ", dialogId }),
  updateProfile: (userId: ID, data: Partial<User>) => dispatch({ type: "UPDATE_PROFILE", userId, data }),
  sendFriendRequest: (fromId: ID, toId: ID) => dispatch({ type: "SEND_FRIEND_REQUEST", fromId, toId }),
  acceptFriendRequest: (requestId: ID) => dispatch({ type: "ACCEPT_FRIEND_REQUEST", requestId }),
  declineFriendRequest: (requestId: ID) => dispatch({ type: "DECLINE_FRIEND_REQUEST", requestId }),
  removeFriend: (a: ID, b: ID) => dispatch({ type: "REMOVE_FRIEND", userId1: a, userId2: b }),
  joinCommunity: (userId: ID, communityId: ID) => dispatch({ type: "JOIN_COMMUNITY", userId, communityId }),
  leaveCommunity: (userId: ID, communityId: ID) => dispatch({ type: "LEAVE_COMMUNITY", userId, communityId }),
  setAdStatus: (adId: ID, status: AdStatusKey) => dispatch({ type: "SET_AD_STATUS", adId, status }),
  archiveAd: (adId: ID) => dispatch({ type: "SET_AD_STATUS", adId, status: "archived" }),
  deleteAd: (adId: ID) => dispatch({ type: "SET_AD_STATUS", adId, status: "deleted" }),
  createAd: (ad: Ad, status: AdStatusKey = "active") => dispatch({ type: "CREATE_AD", ad, status }),
  createPost: (post: Post) => dispatch({ type: "CREATE_POST", post }),
  likePost: (postId: ID, like: boolean) => dispatch({ type: "LIKE_POST", postId, like }),
  savePost: (postId: ID, save: boolean) => dispatch({ type: "SAVE_POST", postId, save }),
  addComment: (postId: ID, comment: Comment) => dispatch({ type: "ADD_COMMENT", postId, comment }),
  setDialogMeta: (dialogId: ID, patch: Partial<DialogMeta>) => dispatch({ type: "SET_DIALOG_META", dialogId, patch }),
  setCurrentUser: (user: User) => dispatch({ type: "SET_CURRENT_USER", user }),
};

// Hydrate the current session user into the store (used after login / on boot).
export function setCurrentUser(user: User): void {
  dispatch({ type: "SET_CURRENT_USER", user });
}

export function setDialogs(dialogs: Dialog[]): void {
  dispatch({ type: "SET_DIALOGS", dialogs });
}

export function setDialogMessages(dialogId: ID, messages: Message[]): void {
  dispatch({ type: "SET_DIALOG_MESSAGES", dialogId, messages });
}

// Upsert an incoming message (from API send or realtime) into a dialog.
export function upsertMessage(dialogId: ID, message: Message): void {
  const d = state.dialogs[dialogId];
  if (!d) return;
  if (d.messages.some((m) => m.id === message.id)) return;
  dispatch({ type: "ADD_MESSAGE", dialogId, message });
}

// Replace an optimistic message (temp id) with the server-confirmed one.
export function replaceMessage(dialogId: ID, tempId: ID, message: Message): void {
  const d = state.dialogs[dialogId];
  if (!d) return;
  const messages = d.messages.map((m) => (m.id === tempId ? message : m));
  dispatch({ type: "SET_DIALOG_MESSAGES", dialogId, messages });
}

// Imperative helper: find an existing dialog with the given user, or create one.
// Always returns the dialogId — never falls back to dialogs[0]. Bug #17.
export function openOrCreateDialogWith(userId: ID): ID {
  const existing = Object.values(state.dialogs).find((d) => d.userId === userId);
  if (existing) return existing.id;
  const id = `d_${userId}_${Date.now()}`;
  const dialog: Dialog = {
    id,
    userId,
    lastMessage: "",
    time: new Date().toISOString(),
    unread: 0,
    messages: [],
  };
  state = { ...state, dialogs: { ...state.dialogs, [id]: dialog } };
  emit();
  return id;
}


export const selectors = {
  currentUser: (s: AppState): User => s.users[s.currentUserId] ?? GUEST_USER,
  dialogsList: (s: AppState): Dialog[] => Object.values(s.dialogs),
  friendsOf: (userId: ID) => (s: AppState): ID[] =>
    s.friendships
      .filter((f) => f.userId1 === userId || f.userId2 === userId)
      .map((f) => (f.userId1 === userId ? f.userId2 : f.userId1)),
  pendingRequests: (userId: ID) => (s: AppState): FriendRequest[] =>
    s.friendRequests.filter((r) => r.toId === userId && r.status === "pending"),
  userCommunities: (userId: ID) => (s: AppState): Community[] =>
    (s.communityMemberships[userId] ?? [])
      .map((id) => s.communities[id])
      .filter((c): c is Community => Boolean(c)),
  myAds: (userId: ID) => (s: AppState): Ad[] =>
    Object.values(s.ads).filter((a) => a.authorId === userId),
  isCommunityMember: (userId: ID, communityId: ID) => (s: AppState): boolean =>
    (s.communityMemberships[userId] ?? []).includes(communityId),
  recommendedCommunities: (userId: ID) => (s: AppState): Community[] => {
    const mine = new Set(s.communityMemberships[userId] ?? []);
    return Object.values(s.communities).filter((c) => !mine.has(c.id));
  },
  dialogMeta: (dialogId: ID) => (s: AppState): DialogMeta =>
    s.dialogMeta[dialogId] ?? { archived: false, muted: false, blocked: false },
};
