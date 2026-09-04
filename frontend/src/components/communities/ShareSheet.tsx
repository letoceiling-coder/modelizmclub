import { useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Link2, Share2, Users } from "lucide-react";
import { storePendingShare } from "@/components/messenger/ShareLinkDialog";
import { getToken } from "@/lib/api/client";
import { isDemoMode } from "@/lib/demo-mode";
import { toast } from "@/lib/toast";
import { SHARE_TARGETS, openShareTarget } from "@/lib/share-targets";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title: string;
  heading?: string;
  /** Community share also offers “send to a friend on the platform”. */
  showSendToFriend?: boolean;
}

export function ShareSheet({
  open,
  onOpenChange,
  url,
  title,
  heading = "Поделиться",
  showSendToFriend = false,
}: Props) {
  const navigate = useNavigate();

  const openFriendPicker = () => {
    if (!isDemoMode() && !getToken()) {
      toast.error("Войдите в аккаунт, чтобы отправить сообщение другу");
      return;
    }
    storePendingShare({ url, title, kind: "community" });
    onOpenChange(false);
    void navigate({ to: "/messenger", search: { share: "1" } });
  };

  const copyLink = async () => {
    try {
      if (typeof navigator !== "undefined") await navigator.clipboard?.writeText(url);
      toast.success("Ссылка скопирована");
    } catch {
      toast.info("Скопируйте ссылку из адресной строки");
    }
    onOpenChange(false);
  };

  const items: Array<{ key: string; label: string; icon: typeof Share2; onClick: () => void }> = [
    ...(showSendToFriend
      ? [
          {
            key: "friend",
            label: "Отправить другу на платформе",
            icon: Users,
            onClick: openFriendPicker,
          },
        ]
      : []),
    ...SHARE_TARGETS.map((target) => ({
      key: target.id,
      label: target.label,
      icon: Share2,
      onClick: () => {
        openShareTarget(target.href(url, title));
        onOpenChange(false);
      },
    })),
    {
      key: "copy",
      label: "Скопировать ссылку",
      icon: Link2,
      onClick: () => {
        void copyLink();
      },
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0 sm:max-w-md sm:left-1/2 sm:-translate-x-1/2"
      >
        <SheetHeader className="px-5 pt-5">
          <SheetTitle>{heading}</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col p-2">
          {items.map((it) => (
            <button
              key={it.key}
              type="button"
              onClick={it.onClick}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[var(--background-surface)]"
            >
              <span
                className="grid h-10 w-10 place-items-center rounded-full"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <it.icon size={18} />
              </span>
              <span className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
                {it.label}
              </span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
