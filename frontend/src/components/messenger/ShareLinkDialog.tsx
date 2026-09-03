import { useEffect, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Plus, X } from "lucide-react";
import { CreateChatDialog } from "@/components/messenger/CreateChatDialog";
import { getToken } from "@/lib/api/client";
import { fetchConversations, openConversation, sendMessage } from "@/lib/api/chat";
import { isDemoMode } from "@/lib/demo-mode";
import { userById } from "@/lib/mock";
import { actions } from "@/lib/store";
import { useCurrentUser } from "@/lib/session";
import { toast } from "@/lib/toast";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { useDialogs, messengerCache } from "@/lib/messenger";

export interface ShareLinkPayload {
  url: string;
  title: string;
  kind?: "community" | "channel" | "post";
}

interface Props {
  payload: ShareLinkPayload | null;
  onClose: () => void;
  onSent?: (dialogId: string) => void;
}

function shareMessage(payload: ShareLinkPayload): string {
  const prefix =
    payload.kind === "channel" ? "Канал" :
    payload.kind === "post" ? "Публикация" :
    "Сообщество";
  return `🔗 ${prefix}: ${payload.title}\n${payload.url}`;
}

export function ShareLinkDialog({ payload, onClose, onSent }: Props) {
  const me = useCurrentUser();
  const { requirePremium } = useGuestAccess();
  const { dialogs } = useDialogs();
  const ref = useRef<HTMLDivElement>(null);
  const open = Boolean(payload);
  const [createChatOpen, setCreateChatOpen] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (isDemoMode() || !getToken()) return;
    void fetchConversations(me.id)
      .then((list) => messengerCache.setDialogs(list))
      .catch(() => toast.error("Не удалось загрузить список диалогов"));
  }, [open, me.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const resolveDialogId = async (partnerId: string): Promise<string> => {
    const existing = messengerCache.findByPartner(partnerId);
    if (existing) return existing.id;

    if (isDemoMode()) {
      const demo = { id: `d_${partnerId}`, userId: partnerId, lastMessage: "", time: new Date().toISOString(), unread: 0, messages: [] };
      messengerCache.restoreDialog(demo);
      return demo.id;
    }

    const partner = userById(partnerId);
    if (!partner.numericId) {
      throw new Error("Не удалось открыть чат с этим пользователем");
    }

    const dialog = await openConversation(partner.numericId, me.id, partner.id);
    return dialog.id;
  };

  const sendTo = async (partnerId: string) => {
    if (!payload || sending) return;
    let allowed = false;
    requirePremium(() => { allowed = true; });
    if (!allowed) return;
    setSending(true);
    const partner = userById(partnerId);
    const text = shareMessage(payload);
    try {
      const dialogId = await resolveDialogId(partnerId);
      if (isDemoMode()) {
        actions.addMessage(dialogId, {
          id: `share-${Date.now()}`,
          authorId: me.id,
          time: new Date().toISOString(),
          text,
          status: "sent",
        });
      } else {
        const saved = await sendMessage(dialogId, text);
        messengerCache.upsert(dialogId, saved);
      }
      toast.success(`Отправлено ${partner.name}`);
      onSent?.(dialogId);
      onClose();
    } catch {
      toast.error("Не удалось отправить сообщение");
    } finally {
      setSending(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {open && payload && (
          <>
            <motion.div
              key="overlay"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.16 }}
              className="fixed inset-0 z-[80]"
              style={{ background: "rgba(0,0,0,0.4)" }}
              onClick={onClose}
            />
            <motion.div
              key="dialog"
              ref={ref}
              initial={{ opacity: 0, y: 12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 12, scale: 0.97 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              role="dialog"
              aria-modal="true"
              aria-labelledby="share-link-title"
              className="fixed left-1/2 top-1/2 z-[81] w-[min(400px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[16px] border"
              style={{
                background: "var(--background-elevated)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-float)",
              }}
            >
              <div className="flex items-center gap-[8px] border-b px-[16px] py-[12px]" style={{ borderColor: "var(--border)" }}>
                <h3 id="share-link-title" className="flex-1 font-display text-[16px] font-bold" style={{ color: "var(--foreground)" }}>
                  Кому отправить
                </h3>
                <button
                  type="button"
                  onClick={onClose}
                  className="grid h-[32px] w-[32px] place-items-center rounded-full"
                  style={{ color: "var(--foreground-50)" }}
                  aria-label="Закрыть"
                >
                  <X size={16} />
                </button>
              </div>

              <p className="border-b px-[16px] py-[10px] text-[12px] leading-relaxed" style={{ borderColor: "var(--border)", color: "var(--foreground-50)" }}>
                {payload.title}
              </p>

              <button
                type="button"
                disabled={sending}
                onClick={() => setCreateChatOpen(true)}
                className="flex w-full items-center gap-[12px] border-b px-[16px] py-[10px] text-left transition-colors hover:bg-[var(--background-surface)] disabled:opacity-60"
                style={{ borderColor: "var(--border)" }}
              >
                <span className="grid h-9 w-9 place-items-center rounded-full" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>
                  <Plus size={16} />
                </span>
                <span className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>Найти пользователя</span>
              </button>

              <ul className="max-h-[360px] overflow-y-auto py-[8px]">
                {dialogs.length === 0 ? (
                  <li className="px-[20px] py-[24px] text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>
                    Нет диалогов. Найдите пользователя или начните переписку.
                  </li>
                ) : (
                  dialogs.map((d) => {
                    const u = userById(d.userId);
                    return (
                      <li key={d.id}>
                        <button
                          type="button"
                          disabled={sending}
                          onClick={() => void sendTo(d.userId)}
                          className="flex w-full items-center gap-[12px] px-[16px] py-[10px] text-left transition-colors hover:bg-[var(--background-surface)] disabled:opacity-60"
                        >
                          <img src={u.avatar} width={36} height={36} loading="lazy" decoding="async" alt="" className="h-[36px] w-[36px] rounded-full object-cover" />
                          <span className="truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
                            {u.name}
                          </span>
                        </button>
                      </li>
                    );
                  })
                )}
              </ul>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      <CreateChatDialog
        open={createChatOpen}
        onClose={() => setCreateChatOpen(false)}
        onPick={(userId) => {
          setCreateChatOpen(false);
          void sendTo(userId);
        }}
      />
    </>
  );
}

export const PENDING_SHARE_STORAGE_KEY = "messenger:pendingShare";

export function readPendingShare(): ShareLinkPayload | null {
  if (typeof sessionStorage === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(PENDING_SHARE_STORAGE_KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as ShareLinkPayload;
    if (!data?.url || !data?.title) return null;
    return data;
  } catch {
    return null;
  }
}

export function storePendingShare(payload: ShareLinkPayload): void {
  sessionStorage.setItem(PENDING_SHARE_STORAGE_KEY, JSON.stringify(payload));
}

export function clearPendingShare(): void {
  sessionStorage.removeItem(PENDING_SHARE_STORAGE_KEY);
}
