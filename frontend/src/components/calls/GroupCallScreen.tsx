import { Suspense, lazy, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { useGroupCall, groupCalls } from "@/lib/groupCall";

const LiveKitRoomUI = lazy(() => import("./LiveKitRoomUI"));

export function GroupCallScreen() {
  const active = useGroupCall((s) => s.active);
  const connecting = useGroupCall((s) => s.connecting);
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return null;
  if (!active && !connecting) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[9998] flex flex-col"
      style={{ height: "100dvh", background: "#0b0b0f", color: "#fff" }}
      role="dialog"
      aria-modal="true"
      aria-label="Групповой звонок"
    >
      {connecting && !active && (
        <div className="grid flex-1 place-items-center text-sm opacity-80">Подключение к групповому звонку…</div>
      )}
      {active && (
        <Suspense fallback={<div className="grid flex-1 place-items-center text-sm opacity-80">Загрузка…</div>}>
          <LiveKitRoomUI active={active} onLeave={() => groupCalls.leave()} />
        </Suspense>
      )}
    </div>,
    document.body,
  );
}
