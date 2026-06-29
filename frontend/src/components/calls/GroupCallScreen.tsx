import { Suspense, lazy, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { UserPlus } from "lucide-react";
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
        <>
          <button
            type="button"
            onClick={() => groupCalls.openPicker("invite")}
            className="absolute z-[10001] inline-flex items-center gap-[6px] rounded-full px-[14px] py-[8px] text-[13px] font-semibold transition-transform active:scale-95"
            style={{
              top: "max(12px, env(safe-area-inset-top))",
              right: 12,
              background: "var(--accent)",
              color: "white",
              boxShadow: "0 8px 24px -6px rgba(0,0,0,0.5)",
            }}
            aria-label="Пригласить участников"
          >
            <UserPlus size={16} /> Пригласить
          </button>
          <Suspense fallback={<div className="grid flex-1 place-items-center text-sm opacity-80">Загрузка…</div>}>
            <LiveKitRoomUI active={active} onLeave={() => groupCalls.leave()} />
          </Suspense>
        </>
      )}
    </div>,
    document.body,
  );
}
