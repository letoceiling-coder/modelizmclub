import { useState } from "react";
import { Flag, Share2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { ComplaintDialog } from "@/components/friends/ComplaintDialog";
import { getToken } from "@/lib/api/client";
import type { User } from "@/lib/mock";

const actionCls =
  "inline-flex items-center gap-[6px] rounded-[10px] px-[10px] py-[7px] text-[13px] font-medium transition-colors hover:bg-[var(--accent-soft)]";

export function VideoActionsMenu({
  videoId,
  videoTitle,
  author,
  isOwn = false,
}: {
  videoId: string;
  videoTitle?: string;
  author: User;
  isOwn?: boolean;
}) {
  const [reportOpen, setReportOpen] = useState(false);

  const share = async () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/reviews/${videoId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    } catch {
      toast.info("Скопируйте ссылку из адресной строки");
    }
  };

  const openReport = () => {
    if (!getToken()) {
      toast.info("Войдите, чтобы пожаловаться на обзор");
      return;
    }
    setReportOpen(true);
  };

  return (
    <>
      <button
        type="button"
        onClick={share}
        aria-label="Поделиться"
        className={actionCls}
        style={{ color: "var(--foreground-70)" }}
      >
        <Share2 size={16} /> Поделиться
      </button>
      {!isOwn && (
        <button
          type="button"
          onClick={openReport}
          aria-label="Пожаловаться"
          className={actionCls}
          style={{ color: "var(--foreground-70)" }}
        >
          <Flag size={16} /> Пожаловаться
        </button>
      )}

      {reportOpen && (
        <ComplaintDialog
          target={author}
          report={{ type: "video", targetId: videoId }}
          descriptionOverride={`Жалоба на обзор${videoTitle ? ` «${videoTitle}»` : ""} — выберите причину и при необходимости опишите ситуацию.`}
          page={`/reviews/${videoId}`}
          subjectSuffix=" (обзор)"
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
  );
}
