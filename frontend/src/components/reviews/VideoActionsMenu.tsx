import { MoreHorizontal, Flag, Link as LinkIcon } from "lucide-react";
import { toast } from "sonner";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";

export function VideoActionsMenu({ videoId }: { videoId: string }) {
  const copyLink = async () => {
    const url = `${typeof window !== "undefined" ? window.location.origin : ""}/reviews/${videoId}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success("Ссылка скопирована");
    } catch {
      toast.info("Скопируйте ссылку из адресной строки");
    }
  };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label="Ещё" className="grid h-[36px] w-[36px] place-items-center rounded-full" style={{ color: "var(--foreground-70)" }}>
          <MoreHorizontal size={18} />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={copyLink}>
          <LinkIcon size={14} /> Копировать ссылку
        </DropdownMenuItem>
        {/* Report is a toast stub — EXACT parity with posts (PostActionMenu has no real report API either). */}
        <DropdownMenuItem onSelect={() => toast("Жалоба: будет доступно позже")}>
          <Flag size={14} /> Пожаловаться
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
