/**
 * Group-call (LiveKit SFU) store. Keeps the join credentials and active room;
 * the heavy LiveKit UI is loaded lazily so SSR is never touched.
 */

import { useSyncExternalStore } from "react";
import { toast } from "sonner";
import { fetchLiveKitToken, inviteToGroup } from "./api/livekit";
import { logEvent } from "./logger";

export type GroupMedia = "audio" | "video";

export interface GroupCallActive {
  room: string;
  url: string;
  token: string;
  media: GroupMedia;
  title?: string;
}

interface GroupCallState {
  active: GroupCallActive | null;
  connecting: boolean;
}

let state: GroupCallState = { active: null, connecting: false };
const listeners = new Set<() => void>();

function emit(): void {
  listeners.forEach((l) => l());
}
function setState(patch: Partial<GroupCallState>): void {
  state = { ...state, ...patch };
  emit();
}

function randomRoom(): string {
  try {
    if (typeof crypto !== "undefined" && crypto.randomUUID) return `g_${crypto.randomUUID().slice(0, 18).replace(/-/g, "")}`;
  } catch {
    /* ignore */
  }
  return `g_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

async function connect(room: string, media: GroupMedia, title?: string): Promise<boolean> {
  setState({ connecting: true });
  try {
    const join = await fetchLiveKitToken(room);
    setState({ active: { room, url: join.url, token: join.token, media, title }, connecting: false });
    logEvent("info", "group", "joined room", { room, media });
    return true;
  } catch (err) {
    setState({ connecting: false });
    logEvent("error", "group", "join failed", { room, message: (err as Error)?.message });
    toast.error("Не удалось подключиться к групповому звонку");
    return false;
  }
}

export const groupCalls = {
  /** Start a new group call and (optionally) ring a list of users. */
  async start(inviteUuids: string[] = [], media: GroupMedia = "video", title?: string): Promise<void> {
    if (state.active) return;
    const room = randomRoom();
    const ok = await connect(room, media, title);
    if (ok && inviteUuids.length > 0) {
      try {
        await inviteToGroup(room, inviteUuids, media, title);
      } catch {
        toast.error("Не удалось пригласить участников");
      }
    }
  },

  /** Join an existing room (from an invite). */
  async join(room: string, media: GroupMedia = "video", title?: string): Promise<void> {
    if (state.active) return;
    await connect(room, media, title);
  },

  leave(): void {
    if (state.active) logEvent("info", "group", "left room", { room: state.active.room });
    setState({ active: null });
  },
};

/** Called by the call signaling layer when a group_invite arrives. */
export function handleGroupInvite(payload: { room?: string; media?: string; title?: string; from?: { name?: string } }): void {
  if (!payload.room || state.active) return;
  const media: GroupMedia = payload.media === "audio" ? "audio" : "video";
  const who = payload.from?.name ?? "Пользователь";
  toast.info(`Групповой звонок — ${who}`, {
    duration: 15000,
    action: {
      label: "Войти",
      onClick: () => void groupCalls.join(payload.room as string, media, payload.title),
    },
  });
}

export function useGroupCall<T>(selector: (s: GroupCallState) => T): T {
  const snap = useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => state,
    () => state,
  );
  return selector(snap);
}
