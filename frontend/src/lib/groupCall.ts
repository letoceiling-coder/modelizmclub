/**
 * Group-call (LiveKit SFU) store. Keeps the join credentials and active room;
 * the heavy LiveKit UI is loaded lazily so SSR is never touched.
 */

import { useSyncExternalStore } from "react";
import { toast } from "@/lib/toast";
import { fetchLiveKitToken, inviteToGroup } from "./api/livekit";
import { logEvent } from "./logger";
import { startRingtone, stopCallSounds } from "./callAudio";

let inviteRingTimer: ReturnType<typeof setTimeout> | null = null;
function stopInviteRing(): void {
  if (inviteRingTimer) {
    clearTimeout(inviteRingTimer);
    inviteRingTimer = null;
  }
  stopCallSounds();
}

export type GroupMedia = "audio" | "video";

export interface GroupCallActive {
  room: string;
  url: string;
  token: string;
  media: GroupMedia;
  title?: string;
}

export interface PickerState {
  mode: "start" | "invite";
  preselect: string[];
}

interface GroupCallState {
  active: GroupCallActive | null;
  connecting: boolean;
  picker: PickerState | null;
}

let state: GroupCallState = { active: null, connecting: false, picker: null };
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

  /** Invite more people into the room we're already in. */
  async inviteMore(uuids: string[], media?: GroupMedia, title?: string): Promise<void> {
    if (!state.active || uuids.length === 0) return;
    try {
      const n = await inviteToGroup(state.active.room, uuids, media ?? state.active.media, title ?? state.active.title);
      toast.success(n === 1 ? "Приглашение отправлено" : `Приглашено: ${n}`);
    } catch {
      toast.error("Не удалось пригласить участников");
    }
  },

  leave(): void {
    if (state.active) logEvent("info", "group", "left room", { room: state.active.room });
    setState({ active: null });
  },

  /** Open the participant picker (to start a new call or invite into the current one). */
  openPicker(mode: "start" | "invite", preselect: string[] = []): void {
    setState({ picker: { mode, preselect } });
  },
  closePicker(): void {
    setState({ picker: null });
  },
};

/** Called by the call signaling layer when a group_invite arrives. */
export function handleGroupInvite(payload: { room?: string; media?: string; title?: string; from?: { name?: string } }): void {
  if (!payload.room || state.active) return;
  const media: GroupMedia = payload.media === "audio" ? "audio" : "video";
  const who = payload.from?.name ?? "Пользователь";

  // Audible ring while the invite toast is shown.
  stopInviteRing();
  startRingtone();
  if (typeof navigator !== "undefined" && navigator.vibrate) {
    try { navigator.vibrate([200, 100, 200]); } catch { /* ignore */ }
  }
  inviteRingTimer = setTimeout(stopInviteRing, 20000);

  toast.info(`Групповой звонок — ${who}`, {
    duration: 20000,
    onDismiss: stopInviteRing,
    onAutoClose: stopInviteRing,
    action: {
      label: "Войти",
      onClick: () => {
        stopInviteRing();
        void groupCalls.join(payload.room as string, media, payload.title);
      },
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
