import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Phone, MoreHorizontal, Info, Search, Bell, BellOff, Archive, ArchiveRestore, Ban, ShieldOff, Users, Pin, PinOff, Trash2, Flag } from "lucide-react";
import { toast } from "@/lib/toast";
import { userById } from "@/lib/mock";
import { blockUser, unblockUser } from "@/lib/api/social";
import { pinConversation, unpinConversation, deleteConversation, clearConversationHistory } from "@/lib/api/chat";
import { isDemoMode } from "@/lib/demo-mode";
import { ConfirmCallDialog } from "@/components/calls/ConfirmCallDialog";
import { ComplaintDialog } from "@/components/friends/ComplaintDialog";
import { calls, useCalls } from "@/lib/calls";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { groupCalls, useGroupCall } from "@/lib/groupCall";
import { actions, useStore, selectors, markDialogDeleted } from "@/lib/store";

interface Props {
  partnerId: string;
  partnerName: string;
  partnerAvatar?: string;
  dialogId?: string;
  pinned?: boolean;
  onSearch: () => void;
  /** Called after "Удалить чат" — parent should deselect this dialog. */
  onDeleted?: () => void;
}

export function ChatHeaderActions({ partnerId, partnerName, partnerAvatar, dialogId, pinned, onSearch, onDeleted }: Props) {
  const { t } = useTranslation();
  const { requirePremium } = useGuestAccess();
  const meta = useStore(dialogId ? selectors.dialogMeta(dialogId) : () => ({ archived: false, muted: false, blocked: false }));
  const blocked = useStore(selectors.isBlocked(partnerId));
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [complaintOpen, setComplaintOpen] = useState(false);
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
    const profilePath = userById(partnerId)?.slug ?? partnerId;
    navigate({ to: "/user/$id", params: { id: profilePath } });
  };

  const toggleMute = () => {
    close();
    if (!dialogId) return;
    if (meta.muted) {
      actions.setDialogMeta(dialogId, { muted: false, mutedUntil: undefined });
      toast.success(t("components.chatHeader.muteEnabled"), { description: t("components.chatHeader.muteEnabledDesc", { name: partnerName }) });
    } else {
      actions.setDialogMeta(dialogId, { muted: true });
      toast.success(t("components.chatHeader.muteDisabled"), { description: t("components.chatHeader.muteDisabledDesc", { name: partnerName }) });
    }
  };

  const toggleArchive = () => {
    close();
    if (!dialogId) return;
    if (meta.archived) {
      actions.setDialogMeta(dialogId, { archived: false });
      toast.success(t("components.chatHeader.restored"), { description: t("components.chatHeader.restoredDesc") });
    } else {
      actions.setDialogMeta(dialogId, { archived: true });
      toast.success(t("components.chatHeader.archived"), { description: t("components.chatHeader.archivedDesc") });
    }
  };

  const togglePin = async () => {
    close();
    if (!dialogId) return;
    if (pinned) {
      actions.pinDialog(dialogId, false);
      if (!isDemoMode()) {
        try { await unpinConversation(dialogId); } catch { toast.error(t("components.chatHeader.unpinFailed")); return; }
      }
      toast.success(t("components.chatHeader.unpinned"));
    } else {
      actions.pinDialog(dialogId, true);
      if (!isDemoMode()) {
        try { await pinConversation(dialogId); } catch { toast.error(t("components.chatHeader.pinFailed")); return; }
      }
      toast.success(t("components.chatHeader.pinned"), { description: t("components.chatHeader.pinnedDesc") });
    }
  };

  const clearHistory = async () => {
    close();
    if (!dialogId) return;
    if (!window.confirm(t("components.chatHeader.clearConfirm", { name: partnerName }))) return;
    if (!isDemoMode()) {
      try {
        await clearConversationHistory(dialogId);
      } catch {
        toast.error(t("components.chatHeader.clearFailed"));
        return;
      }
    }
    actions.clearHistory(dialogId);
    toast.success(t("components.chatHeader.historyCleared"));
  };

  const deleteChat = async () => {
    close();
    if (!dialogId) return;
    if (!window.confirm(t("components.chatHeader.deleteConfirm", { name: partnerName }))) return;
    if (!isDemoMode()) {
      try {
        await clearConversationHistory(dialogId);
        await deleteConversation(dialogId);
      } catch {
        toast.error(t("components.chatHeader.deleteFailed"));
        return;
      }
    }
    actions.clearHistory(dialogId);
    markDialogDeleted(dialogId, partnerId);
    toast.success(t("components.chatHeader.chatDeleted"));
    onDeleted?.();
  };

  const reportUser = () => {
    close();
    setComplaintOpen(true);
  };

  const toggleBlock = async () => {
    close();
    const partner = userById(partnerId);
    const numericId = partner.numericId;
    if (blocked) {
      if (!isDemoMode() && numericId) {
        try { await unblockUser(numericId); } catch { toast.error(t("components.chatHeader.unblockFailed")); return; }
      }
      actions.unblockUser(partnerId);
      toast.success(t("components.chatHeader.userUnblocked", { name: partnerName }), { description: t("components.chatHeader.userUnblockedDesc") });
    } else {
      if (!isDemoMode() && numericId) {
        try { await blockUser(numericId); } catch { toast.error(t("components.chatHeader.blockFailed")); return; }
      }
      actions.blockUser(partnerId);
      toast.success(t("components.chatHeader.userBlockedToast", { name: partnerName }), { description: t("components.chatHeader.userBlockedDesc") });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={onSearch}
        className="grid h-[40px] w-[40px] place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
        style={{ color: "var(--foreground-50)" }}
        aria-label={t("components.chatHeader.searchAria")}
      >
        <Search size={19} />
      </button>

      <button
        type="button"
        onClick={() => {
          if (callBusy) {
            toast(t("components.chatHeader.callBusy"));
            return;
          }
          if (blocked) {
            toast.error(t("components.chatHeader.userBlocked"), { description: t("components.chatHeader.unblockToCall") });
            return;
          }
          requirePremium(() => setConfirmOpen(true));
        }}
        disabled={callBusy}
        className="grid h-[40px] w-[40px] place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)] disabled:opacity-50"
        style={{ color: "var(--accent)" }}
        aria-label={t("components.chatHeader.callAria", { name: partnerName })}
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
          aria-label={t("components.chatHeader.menuAria")}
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
              <Item icon={Info} label={t("components.chatHeader.info")} onClick={goProfile} />
              <Item
                icon={Users}
                label={t("components.chatHeader.groupCall")}
                onClick={() => {
                  close();
                  if (callBusy) {
                    toast(t("components.chatHeader.callBusy"));
                    return;
                  }
                  groupCalls.openPicker("start", [partnerId]);
                }}
              />
              {onSearch && <Item icon={Search} label={t("components.chatHeader.searchInChat")} onClick={() => { close(); onSearch(); }} />}
              <Item
                icon={pinned ? PinOff : Pin}
                label={pinned ? t("components.dialogContextMenu.unpinChat") : t("components.dialogContextMenu.pinChat")}
                onClick={togglePin}
              />
              <Item
                icon={meta.muted ? Bell : BellOff}
                label={meta.muted ? t("components.dialogContextMenu.enableNotifications") : t("components.dialogContextMenu.disableNotifications")}
                onClick={toggleMute}
              />
              <Item
                icon={meta.archived ? ArchiveRestore : Archive}
                label={meta.archived ? t("components.dialogContextMenu.restoreFromArchive") : t("components.chatHeader.archive")}
                onClick={toggleArchive}
              />
              <Item icon={Trash2} label={t("components.dialogContextMenu.clearHistory")} onClick={clearHistory} />
              <Item icon={Trash2} label={t("components.dialogContextMenu.deleteChat")} onClick={deleteChat} danger />
              <div className="border-t" style={{ borderColor: "var(--border)" }} />
              <Item
                icon={blocked ? ShieldOff : Ban}
                label={blocked ? t("components.dialogContextMenu.unblock") : t("components.dialogContextMenu.blockUser")}
                onClick={toggleBlock}
                danger={!blocked}
              />
              <Item icon={Flag} label={t("components.chatHeader.report")} onClick={reportUser} danger />
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
          const avatar = partnerAvatar || userById(partnerId)?.avatar;
          void calls.start(partnerId, partnerName, avatar || undefined, media);
        }}
      />
      <ComplaintDialog
        target={complaintOpen ? userById(partnerId) : null}
        onClose={() => setComplaintOpen(false)}
        page="/messenger"
        report={complaintOpen ? { type: "user", targetId: partnerId } : undefined}
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
