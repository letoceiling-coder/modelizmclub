import "@livekit/components-styles";
import { useEffect, useRef } from "react";
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from "@livekit/components-react";
import type { GroupCallActive } from "@/lib/groupCall";
import { watchAndTranslateLiveKitUI } from "./livekit-i18n";

export default function LiveKitRoomUI({
  active,
  onLeave,
}: {
  active: GroupCallActive;
  onLeave: () => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current) return;
    return watchAndTranslateLiveKitUI(containerRef.current);
  }, []);

  return (
    <div ref={containerRef} style={{ height: "100%", width: "100%" }}>
      <LiveKitRoom
        serverUrl={active.url}
        token={active.token}
        connect
        audio
        video={active.media === "video"}
        onDisconnected={onLeave}
        data-lk-theme="default"
        style={{ height: "100%", width: "100%" }}
      >
        <VideoConference />
        <RoomAudioRenderer />
      </LiveKitRoom>
    </div>
  );
}
