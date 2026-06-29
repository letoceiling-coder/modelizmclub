/**
 * Tracks which users are online via the global Reverb presence channel.
 * Exposes a reactive set of online user UUIDs for the UI.
 */

import { useSyncExternalStore } from "react";
import { GUEST_USER } from "@/lib/store";
import { getToken } from "@/lib/api/client";
import { joinOnlinePresence } from "@/lib/realtime/echo";

let online = new Set<string>();
const listeners = new Set<() => void>();
let unsub: (() => void) | null = null;
let joining = false;

function emit(): void {
  // new identity so useSyncExternalStore re-renders
  online = new Set(online);
  listeners.forEach((l) => l());
}

export async function initPresence(userUuid: string): Promise<void> {
  if (!userUuid || userUuid === GUEST_USER.id || !getToken()) return;
  if (unsub || joining) return;
  joining = true;
  try {
    unsub = await joinOnlinePresence({
      here: (members) => {
        online = new Set(members.map((m) => m.uuid).filter(Boolean));
        emit();
      },
      joining: (m) => {
        if (m.uuid) {
          online.add(m.uuid);
          emit();
        }
      },
      leaving: (m) => {
        if (m.uuid) {
          online.delete(m.uuid);
          emit();
        }
      },
    });
  } finally {
    joining = false;
  }
}

export function resetPresence(): void {
  if (unsub) {
    unsub();
    unsub = null;
  }
  online = new Set();
  emit();
}

export function isUserOnline(uuid: string | undefined | null): boolean {
  return !!uuid && online.has(uuid);
}

function getSnapshot(): Set<string> {
  return online;
}

/** Reactive set of online UUIDs. */
export function useOnlineSet(): Set<string> {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    getSnapshot,
    getSnapshot,
  );
}
