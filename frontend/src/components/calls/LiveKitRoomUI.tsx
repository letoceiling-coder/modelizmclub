import "@livekit/components-styles";
import { LiveKitRoom, VideoConference, RoomAudioRenderer } from "@livekit/components-react";
import type { GroupCallActive } from "@/lib/groupCall";

export default function LiveKitRoomUI({
  active,
  onLeave,
}: {
  active: GroupCallActive;
  onLeave: () => void;
}) {
  return (
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
  );
}
