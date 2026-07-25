import { useState } from "react";
import { MoreHorizontal, Bookmark, BookmarkCheck, Link2, Share2, EyeOff, Flag, Check, Trash2, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { actions } from "@/lib/store";
import { deletePost } from "@/lib/api/feed";
import { approveModeration } from "@/lib/api/admin";
import { isDemoMode } from "@/lib/demo-mode";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface Props {
  postId: string;
  saved: boolean;
  title: string;
  text: string;
  status?: "published" | "moderation";
  canDelete?: boolean;
  isStaff?: boolean;
  onDeleted?: () => void;
  onApproved?: () => void;
}

export function PostActionMenu({
  postId,
  saved,
  title,
  text,
  status,
  canDelete = false,
  isStaff = false,
  onDeleted,
  onApproved,
}: Props) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);

  const showApprove = isStaff && status === "moderation";
  const showDelete = canDelete || isStaff;

  const buildUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/?post=${postId}`;
  };

  const close = () => setOpen(false);

  const handleSave = () => {
    actions.savePost(postId, !saved);
    toast.success(saved ? "Удалено из сохранённых" : "Добавлено в сохранённые");
    close();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildUrl());
      setCopied(true);
      toast.success("Ссылка скопирована");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  };

  const handleShare = async () => {
    close();
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title, text, url: buildUrl() });
        return;
      } catch {
        // user cancelled or unsupported — fall through to copy
      }
    }
    await handleCopy();
  };

  const handleApprove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isDemoMode()) {
        toast.success("Публикация одобрена");
        onApproved?.();
        close();
        return;
      }
      await approveModeration("posts", postId);
      toast.success("Публикация одобрена");
      onApproved?.();
      close();
    } catch (err) {
      toast.error(formatApiErrorMessage(err, "Не удалось одобрить публикацию"));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    if (!window.confirm("Удалить эту публикацию?")) return;
    setBusy(true);
    try {
      if (isDemoMode()) {
        toast.success("Публикация удалена");
        onDeleted?.();
        close();
        return;
      }
      await deletePost(postId);
      toast.success("Публикация удалена");
      onDeleted?.();
      close();
    } catch (err) {
      toast.error(formatApiErrorMessage(err, "Не удалось удалить публикацию"));
    } finally {
      setBusy(false);
    }
  };

  const placeholder = (label: string) => () => {
    close();
    toast(`${label}: будет доступно позже`);
  };

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="relative grid h-[32px] w-[32px] place-items-center rounded-[8px] hover:bg-[var(--background-surface)] before:absolute before:left-1/2 before:top-1/2 before:h-[44px] before:w-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
          style={{ color: "var(--foreground-70)" }}
          aria-label="Меню действий"
        >
          <MoreHorizontal className="h-[16px] w-[16px]" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="z-[200] w-[240px] overflow-hidden rounded-[12px] border p-0"
        style={{
          background: "var(--background-elevated)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        {showApprove && (
          <>
            <MenuItem
              onClick={handleApprove}
              icon={ShieldCheck}
              label="Одобрить модерацию"
              accent
              disabled={busy}
            />
            <DropdownMenuSeparator className="m-0" style={{ background: "var(--border)" }} />
          </>
        )}
        <MenuItem onClick={handleSave} icon={saved ? BookmarkCheck : Bookmark} label={saved ? "Убрать из сохранённых" : "Сохранить"} accent={saved} />
        <MenuItem onClick={handleCopy} icon={copied ? Check : Link2} label={copied ? "Скопировано" : "Скопировать ссылку"} accent={copied} />
        <MenuItem onClick={handleShare} icon={Share2} label="Поделиться" />
        <DropdownMenuSeparator className="m-0" style={{ background: "var(--border)" }} />
        <MenuItem onClick={placeholder("Скрыть публикацию")} icon={EyeOff} label="Скрыть" />
        <MenuItem onClick={placeholder("Жалоба")} icon={Flag} label="Пожаловаться" />
        {showDelete && (
          <>
            <DropdownMenuSeparator className="m-0" style={{ background: "var(--border)" }} />
            <MenuItem
              onClick={handleDelete}
              icon={Trash2}
              label="Удалить"
              danger
              disabled={busy}
            />
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function MenuItem({
  icon: Icon,
  label,
  onClick,
  accent,
  danger,
  disabled,
}: {
  icon: typeof Bookmark;
  label: string;
  onClick: () => void;
  accent?: boolean;
  danger?: boolean;
  disabled?: boolean;
}) {
  return (
    <DropdownMenuItem
      onClick={onClick}
      disabled={disabled}
      className="flex cursor-pointer items-center gap-[10px] rounded-none px-[14px] py-[10px] text-[13px] focus:bg-[var(--background-surface)]"
      style={{ color: danger ? "var(--destructive, #e5484d)" : "var(--foreground)" }}
    >
      <Icon
        className="h-[16px] w-[16px]"
        style={{
          color: danger
            ? "var(--destructive, #e5484d)"
            : accent
              ? "var(--accent)"
              : "var(--foreground-70)",
        }}
      />
      {label}
    </DropdownMenuItem>
  );
}
