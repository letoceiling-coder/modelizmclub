import { useEffect, useState } from "react";
import { fetchUnreadCount } from "@/lib/api/notifications";
import { getToken } from "@/lib/api/client";

// Polls the unread-notifications count so the bell badge stays roughly live.
// Only runs while authenticated; safe to mount in multiple places.
export function useUnreadNotifications(intervalMs = 60_000): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    if (!getToken()) return;
    let active = true;

    const tick = () => {
      fetchUnreadCount().then((n) => {
        if (active) setCount(n);
      });
    };

    tick();
    const id = setInterval(tick, intervalMs);
    return () => {
      active = false;
      clearInterval(id);
    };
  }, [intervalMs]);

  return count;
}
