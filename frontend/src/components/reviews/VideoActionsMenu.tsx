import { Flag, Share2 } from "lucide-react";
import { toast } from "@/lib/toast";

const actionCls =
  "inline-flex items-center gap-[6px] rounded-[10px] px-[10px] py-[7px] text-[13px] font-medium transition-colors hover:bg-[var(--accent-soft)]";

export function VideoActionsMenu({ videoId }: { videoId: string }) {
  const share = async () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/reviews/${videoId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    } catch {
      toast.info("Скопируйте ссылку из адресной строки");
    }
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
      {/* Report is a toast stub — EXACT parity with posts (PostActionMenu has no real report API either). */}
      <button
        type="button"
        onClick={() => toast("Жалоба: будет доступно позже")}
        aria-label="Пожаловаться"
        className={actionCls}
        style={{ color: "var(--foreground-70)" }}
      >
        <Flag size={16} /> Пожаловаться
      </button>
    </>
  );
}
