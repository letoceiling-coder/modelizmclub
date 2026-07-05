import { FileText } from "lucide-react";
import type { MessageFile } from "@/lib/mock";

export function MessageFileBubble({ file, isMe }: { file: MessageFile; isMe: boolean }) {
  if (file.kind === "video") {
    return (
      <video
        src={file.url}
        controls
        className="mb-[6px] w-full object-cover"
        style={{ borderRadius: 12, maxWidth: 280, maxHeight: 320 }}
      />
    );
  }

  const sizeLabel =
    file.size >= 1024 * 1024
      ? `${(file.size / (1024 * 1024)).toFixed(1)} МБ`
      : `${Math.max(1, Math.round(file.size / 1024))} КБ`;

  return (
    <a
      href={file.url}
      download={file.name}
      className="mb-[6px] flex items-center gap-[10px] px-[12px] py-[10px] transition-opacity hover:opacity-90"
      style={{
        borderRadius: 12,
        background: isMe ? "rgba(255,255,255,0.14)" : "var(--background-elevated)",
        maxWidth: 260,
      }}
    >
      <div
        className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full"
        style={{ background: isMe ? "rgba(255,255,255,0.2)" : "var(--accent-soft)" }}
      >
        <FileText size={18} style={{ color: isMe ? "white" : "var(--accent)" }} />
      </div>
      <div className="min-w-0">
        <div
          className="truncate text-[13px] font-medium"
          style={{ color: isMe ? "white" : "var(--foreground)" }}
        >
          {file.name}
        </div>
        <div
          className="text-[11px]"
          style={{ color: isMe ? "rgba(255,255,255,0.7)" : "var(--foreground-50)" }}
        >
          {sizeLabel}
        </div>
      </div>
    </a>
  );
}
