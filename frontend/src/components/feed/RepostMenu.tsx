import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { Repeat2, Share2, MessageSquare, Link2, Check, ArrowLeft } from "lucide-react";
import { toast } from "@/lib/toast";
import { useStore, selectors, openOrCreateDialogWith, actions } from "@/lib/store";
import { userById } from "@/lib/mock";

interface Props {
  postId: string;
  reposted: boolean;
  count: number;
  onRepost: () => void;
}

type View = "main" | "chats";

export function RepostMenu({ postId, reposted, count, onRepost }: Props) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const dialogs = useStore(selectors.dialogsList);
  const me = useStore(selectors.currentUser);
  const navigate = useNavigate();

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setView("main");
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (view === "chats") setView("main");
        else setOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, view]);

  const url = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/?post=${postId}`;
  };

  const close = () => {
    setOpen(false);
    setView("main");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      toast.success("Ссылка скопирована");
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error("Не удалось скопировать ссылку");
    }
  };

  const repostToFeed = () => {
    onRepost();
    toast.success(reposted ? "Репост отменён" : "Репост добавлен в вашу ленту");
    close();
  };

  const shareExternal = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({ title: "Публикация", url: url() });
        close();
        return;
      } catch {
        // fall through to copy
      }
    }
    await copyLink();
    close();
  };

  const sendToChat = (dialogId: string, partnerName: string) => {
    actions.addMessage(dialogId, {
      id: `nm${Date.now()}`,
      authorId: me.id,
      time: new Date().toISOString(),
      text: `🔗 Поделился публикацией: ${url()}`,
      status: "sent",
    });
    toast.success(`Отправлено ${partnerName}`);
    close();
    navigate({ to: "/messenger", search: { chat: dialogId } });
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-[6px] rounded-[10px] px-[10px] py-[6px] text-[13px] transition-colors"
        style={{
          color: reposted ? "var(--accent)" : "var(--foreground-70)",
          background: open ? "var(--background-surface)" : "transparent",
        }}
        aria-label="Репост"
        aria-expanded={open}
      >
        <Repeat2 className="h-[16px] w-[16px]" />
        {count > 0 && <span className="tabular-nums">{count}</span>}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className="absolute bottom-full left-0 z-[60] mb-[8px] w-[260px] overflow-hidden rounded-[12px] border"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            {view === "main" && (
              <>
                <Item onClick={repostToFeed} icon={Repeat2} label={reposted ? "Отменить репост" : "Репост в ленту"} accent />
                <Item onClick={() => setView("chats")} icon={MessageSquare} label="Отправить в сообщения" />
                <Item
                  onClick={copyLink}
                  icon={copied ? Check : Link2}
                  label={copied ? "Скопировано" : "Скопировать ссылку"}
                  accent={copied}
                />
                <div className="border-t" style={{ borderColor: "var(--border)" }} />
                <Item onClick={shareExternal} icon={Share2} label="Внешние сети" />
              </>
            )}
            {view === "chats" && (
              <div>
                <button
                  type="button"
                  onClick={() => setView("main")}
                  className="flex w-full items-center gap-[8px] border-b px-[14px] py-[10px] text-[13px] font-semibold"
                  style={{ color: "var(--foreground)", borderColor: "var(--border)" }}
                >
                  <ArrowLeft className="h-[14px] w-[14px]" /> Куда отправить
                </button>
                <div className="max-h-[280px] overflow-y-auto">
                  {dialogs.length === 0 ? (
                    <div className="px-[14px] py-[16px] text-center text-[12px]" style={{ color: "var(--foreground-50)" }}>
                      Нет диалогов
                    </div>
                  ) : (
                    dialogs.map((d) => {
                      const u = userById(d.userId);
                      return (
                        <button
                          key={d.id}
                          type="button"
                          onClick={() => sendToChat(d.id, u.name)}
                          className="flex w-full items-center gap-[10px] px-[14px] py-[8px] text-left transition-colors hover:bg-[var(--background-surface)]"
                        >
                          <img src={u.avatar} alt="" className="h-[28px] w-[28px] rounded-full object-cover" />
                          <span className="text-[13px]" style={{ color: "var(--foreground)" }}>{u.name}</span>
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Item({
  icon: Icon,
  label,
  onClick,
  accent,
}: {
  icon: typeof Repeat2;
  label: string;
  onClick: () => void;
  accent?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-[10px] px-[14px] py-[10px] text-left text-[13px] transition-colors hover:bg-[var(--background-surface)]"
      style={{ color: "var(--foreground)" }}
    >
      <Icon className="h-[16px] w-[16px]" style={{ color: accent ? "var(--accent)" : "var(--foreground-70)" }} />
      {label}
    </button>
  );
}
