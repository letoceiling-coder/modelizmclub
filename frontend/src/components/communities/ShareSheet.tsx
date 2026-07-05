import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Link2, Share2, Users } from "lucide-react";
import { toast } from "sonner";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title: string;
}

export function ShareSheet({ open, onOpenChange, url, title }: Props) {
  const text = `${title} — ${url}`;
  const items = [
    {
      key: "friend",
      label: "Отправить другу на платформе",
      icon: Users,
      onClick: () => {
        toast.success("Открываем мессенджер", { description: "Выберите получателя" });
        onOpenChange(false);
      },
    },
    {
      key: "copy",
      label: "Скопировать ссылку",
      icon: Link2,
      onClick: () => {
        if (typeof navigator !== "undefined") navigator.clipboard?.writeText(url);
        toast.success("Ссылка скопирована");
        onOpenChange(false);
      },
    },
    {
      key: "vk",
      label: "ВКонтакте",
      icon: Share2,
      onClick: () => {
        window.open(`https://vk.com/share.php?url=${encodeURIComponent(url)}&title=${encodeURIComponent(title)}`, "_blank", "noopener,noreferrer");
        onOpenChange(false);
      },
    },
    {
      key: "wa",
      label: "WhatsApp",
      icon: Share2,
      onClick: () => {
        window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
        onOpenChange(false);
      },
    },
  ];

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-2xl p-0 sm:max-w-md sm:left-1/2 sm:-translate-x-1/2">
        <SheetHeader className="px-5 pt-5">
          <SheetTitle>Поделиться сообществом</SheetTitle>
        </SheetHeader>
        <div className="flex flex-col p-2">
          {items.map((it) => (
            <button
              key={it.key}
              onClick={it.onClick}
              className="flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[var(--background-surface)]"
            >
              <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                <it.icon size={18} />
              </span>
              <span className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>{it.label}</span>
            </button>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
