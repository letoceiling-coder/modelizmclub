import { useCallback, useEffect, useState } from "react";
import {
  acceptFriendRequest,
  declineFriendRequest,
  fetchFriends,
  fetchIncomingFriendRequests,
  hasAuthForApi,
  removeFriend,
  sendFriendRequest,
  type FriendRequestItem,
  type FriendUser,
} from "./friends";

export function useFriendsApi() {
  const [enabled, setEnabled] = useState(false);
  const [loading, setLoading] = useState(true);
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const [requests, setRequests] = useState<FriendRequestItem[]>([]);

  const reload = useCallback(async () => {
    if (!hasAuthForApi()) {
      setEnabled(false);
      setFriends([]);
      setRequests([]);
      return;
    }
    try {
      const [f, r] = await Promise.all([fetchFriends(), fetchIncomingFriendRequests()]);
      setFriends(f);
      setRequests(r);
      setEnabled(true);
    } catch {
      setEnabled(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      if (!hasAuthForApi()) {
        if (!cancelled) {
          setEnabled(false);
          setLoading(false);
        }
        return;
      }
      try {
        const [f, r] = await Promise.all([fetchFriends(), fetchIncomingFriendRequests()]);
        if (!cancelled) {
          setFriends(f);
          setRequests(r);
          setEnabled(true);
        }
      } catch {
        if (!cancelled) setEnabled(false);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const friendIds = new Set(friends.map((f) => f.id));

  return {
    enabled,
    loading,
    friends,
    requests,
    friendIds,
    reload,
    accept: async (requestId: number) => {
      await acceptFriendRequest(requestId);
      await reload();
    },
    decline: async (requestId: number) => {
      await declineFriendRequest(requestId);
      await reload();
    },
    sendRequest: async (userId: number) => {
      await sendFriendRequest(userId);
      await reload();
    },
    remove: async (userId: number) => {
      await removeFriend(userId);
      await reload();
    },
  };
}
