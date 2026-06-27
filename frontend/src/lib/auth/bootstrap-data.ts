import { getToken } from "@/lib/api/client";
import { loadCommunitiesIntoStore } from "@/lib/api/communities";
import { loadConversationsIntoStore } from "@/lib/api/chat";
import { loadFriendsIntoStore } from "@/lib/api/friends";
import { loadMyListingsIntoStore } from "@/lib/api/listings";

let privateLoaded = false;

/** Load app data from backend. Communities are public; rest requires auth. */
export async function bootstrapAppData(): Promise<void> {
  await loadCommunitiesIntoStore().catch(() => {});

  if (!getToken() || privateLoaded) return;
  privateLoaded = true;

  await Promise.allSettled([
    loadMyListingsIntoStore(),
    loadConversationsIntoStore(),
    loadFriendsIntoStore(),
  ]);
}

export function resetAppDataBootstrap(): void {
  privateLoaded = false;
}
