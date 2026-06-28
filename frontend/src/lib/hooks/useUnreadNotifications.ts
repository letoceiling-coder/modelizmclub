import { useEffect, useState } from "react";
import { fetchUnreadCount } from "@/lib/api/notifications";
import { getToken } from "@/lib/api/client";
import { onUnreadBump } from "@/lib/realtime/user";

// Keeps the bell badge live via WebSocket + a short polling fallback.
export function useUnreadNotifications(intervalMs = 15_000): number {
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
    const unsubBump = onUnreadBump(() => tick());
    return () => {
      active = false;
      clearInterval(id);
      unsubBump();
    };
  }, [intervalMs]);

  return count;
}
