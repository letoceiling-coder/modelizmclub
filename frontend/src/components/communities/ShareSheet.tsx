import { useEffect, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ArrowLeft, Link2, Plus, Share2, Users } from "lucide-react";
import { CreateChatDialog } from "@/components/messenger/CreateChatDialog";
import { getToken } from "@/lib/api/client";
import { fetchConversations, openConversation, sendMessage } from "@/lib/api/chat";
import { isDemoMode } from "@/lib/demo-mode";
import { userById } from "@/lib/mock";
import {
  actions,
  getState,
  openOrCreateDialogWith,
  selectors,
  setDialogs,
  upsertMessage,
  useStore,
} from "@/lib/store";
import { toast } from "@/lib/toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  url: string;
  title: string;
}

type View = "main" | "friends";

export function ShareSheet({ open, onOpenChange, url, title }: Props) {
  const navigate = useNavigate();
  const me = useStore(selectors.currentUser);
  const dialogs = useStore(selectors.dialogsList);
  const [view, setView] = useState<View>("main");
  const [createChatOpen, setCreateChatOpen] = useState(false);
  const [sending, setSending] = useState(false);

  const text = `${title} — ${url}`;
  const shareText = `🔗 Сообщество: ${title}\n${url}`;

  useEffect(() => {
    if (!open) {
      setView("main");
      setCreateChatOpen(false);
      setSending(false);
    }
  }, [open]);

  useEffect(() => {
    if (!open || view !== "friends" || isDemoMode() || !getToken()) return;
    void fetchConversations(me.id)
      .then(setDialogs)
      .catch(() => toast.error("Не удалось загрузить список диалогов"));
  }, [open, view, me.id]);

  const resolveDialogId = async (partnerId: string): Promise<string> => {
    const existing = Object.values(getState().dialogs).find((d) => d.userId === partnerId);
    if (existing) return existing.id;

    if (isDemoMode()) {
      return openOrCreateDialogWith(partnerId);
    }

    const partner = userById(partnerId);
    if (!partner.numericId) {
      throw new Error("Не удалось открыть чат с этим пользователем");
    }

    const dialog = await openConversation(partner.numericId, me.id, partner.id);
    return dialog.id;
  };

  const sendToFriend = async (partnerId: string) => {
    if (sending) return;
    setSending(true);
    const partner = userById(partnerId);
    try {
      const dialogId = await resolveDialogId(partnerId);
      if (isDemoMode()) {
        actions.addMessage(dialogId, {
          id: `share-${Date.now()}`,
          authorId: me.id,
          time: new Date().toISOString(),
          text: shareText,
          status: "sent",
        });
      } else {
        const saved = await sendMessage(dialogId, shareText);
        upsertMessage(dialogId, saved);
      }
      toast.success(`Отправлено ${partner.name}`);
      onOpenChange(false);
      void navigate({ to: "/messenger", search: { chat: dialogId } });
    } catch {
      toast.error("Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  };

  const openFriendPicker = () => {
    if (!isDemoMode() && !getToken()) {
      toast.error("Войдите в аккаунт, чтобы отправить сообщение другу");
      return;
    }
    setView("friends");
  };

  const items = [
    {
      key: "friend",
      label: "Отправить другу на платформе",
      icon: Users,
      onClick: openFriendPicker,
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
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="bottom" className="rounded-t-2xl p-0 sm:max-w-md sm:left-1/2 sm:-translate-x-1/2">
          <SheetHeader className="px-5 pt-5">
            <SheetTitle>{view === "friends" ? "Кому отправить" : "Поделиться сообществом"}</SheetTitle>
          </SheetHeader>

          {view === "main" ? (
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
          ) : (
            <div className="flex flex-col">
              <button
                type="button"
                onClick={() => setView("main")}
                className="mx-2 mb-1 flex items-center gap-2 rounded-xl px-3 py-2 text-[13px] font-semibold transition-colors hover:bg-[var(--background-surface)]"
                style={{ color: "var(--foreground-70)" }}
              >
                <ArrowLeft size={16} /> Назад
              </button>

              <button
                type="button"
                disabled={sending}
                onClick={() => setCreateChatOpen(true)}
                className="mx-2 mb-2 flex items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors hover:bg-[var(--background-surface)] disabled:opacity-60"
              >
                <span className="grid h-10 w-10 place-items-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <Plus size={18} />
                </span>
                <span className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>Найти пользователя</span>
              </button>

              <ul className="max-h-[320px] overflow-y-auto px-2 pb-4">
                {dialogs.length === 0 ? (
                  <li className="px-3 py-6 text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>
                    Нет диалогов. Найдите пользователя или начните переписку в мессенджере.
                  </li>
                ) : (
                  dialogs.map((d) => {
                    const u = userById(d.userId);
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => void sendToFriend(d.userId)}
                          className="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--background-surface)] disabled:opacity-60"
                        >
                          <img src={u.avatar} alt="" className="h-10 w-10 rounded-full object-cover" />
                          <span className="truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>
                            {u.name}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </div>
          )}
        </SheetContent>
      </Sheet>

      <CreateChatDialog
        open={createChatOpen}
        onClose={() => setCreateChatOpen(false)}
        onPick={(userId) => {
          setCreateChatOpen(false);
          void sendToFriend(userId);
        }}
      />
    </>
  );
}
