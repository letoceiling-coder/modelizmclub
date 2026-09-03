/**
 * Tracks which users are online via the global Reverb presence channel.
 * Exposes a reactive set of online user UUIDs for the UI.
 */

import { useSyncExternalStore } from "react";
import { registerUser } from "@/lib/mock";
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

function memberUuid(m: {
  uuid?: string;
  id?: string | number;
  info?: { uuid?: string };
}): string | null {
  if (m.uuid) return m.uuid;
  if (m.info?.uuid) return m.info.uuid;
  if (typeof m.id === "string" && m.id.includes("-")) return m.id;
  return null;
}

export async function initPresence(userUuid: string): Promise<void> {
  if (!userUuid || userUuid === GUEST_USER.id || !getToken()) return;
  if (unsub || joining) return;
  joining = true;
  try {
    unsub = await joinOnlinePresence({
      here: (members) => {
        online = new Set(members.map((m) => memberUuid(m)).filter(Boolean) as string[]);
        for (const uuid of online) {
          registerUser({ id: uuid, online: true });
        }
        emit();
      },
      joining: (m) => {
        const uuid = memberUuid(m);
        if (uuid) {
          online.add(uuid);
          registerUser({ id: uuid, online: true });
          emit();
        }
      },
      leaving: (m) => {
        const uuid = memberUuid(m);
        if (uuid) {
          online.delete(uuid);
          const leftAt = new Date().toISOString();
          registerUser({ id: uuid, online: false, lastSeenAt: leftAt });
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
