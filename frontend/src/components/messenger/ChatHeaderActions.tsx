import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { Phone, MoreHorizontal, Info, Search, Bell, BellOff, Archive, ArchiveRestore, Ban, ShieldOff, Users, Pin, PinOff, Trash2, Flag } from "lucide-react";
import { toast } from "sonner";
import { ConfirmCallDialog } from "@/components/calls/ConfirmCallDialog";
import { calls, useCalls } from "@/lib/calls";
import { groupCalls, useGroupCall } from "@/lib/groupCall";
import { actions, useStore, selectors } from "@/lib/store";

interface Props {
  partnerId: string;
  partnerName: string;
  dialogId?: string;
  pinned?: boolean;
  onSearch?: () => void;
}

export function ChatHeaderActions({ partnerId, partnerName, dialogId, pinned, onSearch }: Props) {
  const meta = useStore(dialogId ? selectors.dialogMeta(dialogId) : () => ({ archived: false, muted: false, blocked: false }));
  const blocked = useStore(selectors.isBlocked(partnerId));
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const activeCall = useCalls((s) => s.active);
  const groupActive = useGroupCall((s) => !!s.active || s.connecting);
  const callBusy = (!!activeCall && activeCall.status !== "ended") || groupActive;
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const canHover = typeof window !== "undefined" && window.matchMedia?.("(hover: hover) and (pointer: fine)").matches;

  const cancelScheduledClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };
  const scheduleClose = () => {
    cancelScheduledClose();
    closeTimer.current = setTimeout(() => setOpen(false), 150);
  };

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  useEffect(() => {
    if (!confirmOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setConfirmOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [confirmOpen]);

  const close = () => setOpen(false);

  const goProfile = () => {
    close();
    navigate({ to: "/user/$id", params: { id: partnerId } });
  };

  const toggleMute = () => {
    close();
    if (!dialogId) return;
    if (meta.muted) {
      actions.setDialogMeta(dialogId, { muted: false, mutedUntil: undefined });
      toast.success("Уведомления включены", { description: `Вы снова получаете уведомления от ${partnerName}` });
    } else {
      actions.setDialogMeta(dialogId, { muted: true });
      toast.success("Уведомления отключены", { description: `Чат с ${partnerName} больше не присылает уведомления` });
    }
  };

  const toggleArchive = () => {
    close();
    if (!dialogId) return;
    if (meta.archived) {
      actions.setDialogMeta(dialogId, { archived: false });
      toast.success("Чат восстановлен", { description: "Диалог вернулся в активный список" });
    } else {
      actions.setDialogMeta(dialogId, { archived: true });
      toast.success("Чат заархивирован", { description: "Чат перемещён в архив. Вы можете найти его в списке архивированных." });
    }
  };

  const togglePin = () => {
    close();
    if (!dialogId) return;
    if (pinned) {
      actions.pinDialog(dialogId, false);
      toast.success("Чат откреплён");
    } else {
      actions.pinDialog(dialogId, true);
      toast.success("Чат закреплён", { description: "Теперь он вверху списка" });
    }
  };

  const clearHistory = () => {
    close();
    if (!dialogId) return;
    if (!window.confirm(`Очистить историю переписки с ${partnerName}? Это действие нельзя отменить.`)) return;
    actions.clearHistory(dialogId);
    toast.success("История очищена");
  };

  const reportUser = () => {
    close();
    toast("Жалоба: будет доступно позже");
  };

  const toggleBlock = () => {
    close();
    if (blocked) {
      actions.unblockUser(partnerId);
      toast.success(`${partnerName} разблокирован`, { description: "Вы снова можете обмениваться сообщениями" });
    } else {
      actions.blockUser(partnerId);
      toast.success(`${partnerName} заблокирован`, { description: "Вы больше не будете получать сообщения от этого пользователя, он исчез из ваших друзей" });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (callBusy) {
            toast("Звонок уже идёт");
            return;
          }
          if (blocked) {
            toast.error("Пользователь заблокирован", { description: "Разблокируйте, чтобы позвонить" });
            return;
          }
          setConfirmOpen(true);
        }}
        disabled={callBusy}
        className="grid h-[40px] w-[40px] place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)] disabled:opacity-50"
        style={{ color: "var(--accent)" }}
        aria-label={`Позвонить ${partnerName}`}
      >
        <Phone size={19} />
      </button>

      <div
        className="relative"
        ref={ref}
        onMouseEnter={() => { if (canHover) { cancelScheduledClose(); setOpen(true); } }}
        onMouseLeave={() => { if (canHover) scheduleClose(); }}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-[36px] w-[36px] place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-50)" }}
          aria-label="Меню чата"
          aria-expanded={open}
        >
          <MoreHorizontal size={18} />
        </button>

        <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.16, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-full z-[60] mt-[6px] w-[260px] overflow-hidden rounded-[12px] border"
              style={{
                background: "var(--background-elevated)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-float)",
              }}
            >
              <Item icon={Info} label="Информация" onClick={goProfile} />
              <Item
                icon={Users}
                label="Групповой звонок"
                onClick={() => {
                  close();
                  if (callBusy) {
                    toast("Звонок уже идёт");
                    return;
                  }
                  groupCalls.openPicker("start", [partnerId]);
                }}
              />
              {onSearch && <Item icon={Search} label="Поиск в чате" onClick={() => { close(); onSearch(); }} />}
              <Item
                icon={pinned ? PinOff : Pin}
                label={pinned ? "Открепить чат" : "Закрепить чат"}
                onClick={togglePin}
              />
              <Item
                icon={meta.muted ? Bell : BellOff}
                label={meta.muted ? "Включить уведомления" : "Отключить уведомления"}
                onClick={toggleMute}
              />
              <Item
                icon={meta.archived ? ArchiveRestore : Archive}
                label={meta.archived ? "Вернуть из архива" : "Архивировать"}
                onClick={toggleArchive}
              />
              <Item icon={Trash2} label="Очистить историю" onClick={clearHistory} />
              <div className="border-t" style={{ borderColor: "var(--border)" }} />
              <Item
                icon={blocked ? ShieldOff : Ban}
                label={blocked ? "Разблокировать" : "Заблокировать"}
                onClick={toggleBlock}
                danger={!blocked}
              />
              <Item icon={Flag} label="Пожаловаться" onClick={reportUser} danger />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmCallDialog
        open={confirmOpen}
        peerId={partnerId}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={(media) => {
          setConfirmOpen(false);
          void calls.start(partnerId, partnerName, undefined, media);
        }}
      />
    </>
  );
}

function Item({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Info;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-[10px] px-[14px] py-[10px] text-left text-[13px] transition-colors hover:bg-[var(--background-surface)]"
      style={{ color: danger ? "var(--error)" : "var(--foreground)" }}
    >
      <Icon className="h-[16px] w-[16px]" />
      {label}
    </button>
  );
}
