import { useTranslation } from "@/lib/i18n";
import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { Phone, MoreHorizontal, Info, Search, Bell, BellOff, Archive, ArchiveRestore, Ban, ShieldOff } from "lucide-react";
import { toast } from "sonner";
import { ConfirmCallDialog } from "@/components/calls/ConfirmCallDialog";
import { calls, useCalls } from "@/lib/calls";

export type DialogMeta = {
  archived: boolean;
  muted: boolean;
  blocked: boolean;
  mutedUntil?: string;
};

interface Props {
  partnerId: string;
  partnerName: string;
  dialogId?: string;
  meta?: DialogMeta;
  onMetaChange?: (patch: Partial<DialogMeta>) => void;
  onSearch?: () => void;
}

export function ChatHeaderActions({ partnerId, partnerName, dialogId, meta, onMetaChange, onSearch }: Props) {
  const { t } = useTranslation();
  const dialogMeta = meta ?? { archived: false, muted: false, blocked: false };
  const [open, setOpen] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const activeCall = useCalls((s) => s.active);
  const callBusy = !!activeCall && activeCall.status !== "ended";
  const ref = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

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
    if (dialogMeta.muted) {
      onMetaChange?.({ muted: false, mutedUntil: undefined });
      toast.success(t("messenger.notificationsEnabled"), { description: t("messenger.notificationsEnabledDesc", { name: partnerName }) });
    } else {
      onMetaChange?.({ muted: true });
      toast.success(t("messenger.notificationsDisabled"), { description: t("messenger.notificationsDisabledDesc", { name: partnerName }) });
    }
  };

  const toggleArchive = () => {
    close();
    if (!dialogId) return;
    if (dialogMeta.archived) {
      onMetaChange?.({ archived: false });
      toast.success(t("messenger.chatRestored"), { description: t("messenger.chatRestoredDesc") });
    } else {
      onMetaChange?.({ archived: true });
      toast.success(t("messenger.chatArchived"), { description: t("messenger.chatArchivedDesc") });
    }
  };

  const toggleBlock = () => {
    close();
    if (!dialogId) return;
    if (dialogMeta.blocked) {
      onMetaChange?.({ blocked: false });
      toast.success(t("messenger.userUnblocked", { name: partnerName }), { description: t("messenger.userUnblockedDesc") });
    } else {
      onMetaChange?.({ blocked: true });
      toast.success(t("messenger.userBlockedToast", { name: partnerName }), { description: t("messenger.userBlockedToastDesc") });
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={() => {
          if (callBusy) {
            toast(t("calls.callInProgress"));
            return;
          }
          if (dialogMeta.blocked) {
            toast.error(t("messenger.userBlocked"), { description: t("messenger.callBlockedDesc") });
            return;
          }
          setConfirmOpen(true);
        }}
        disabled={callBusy}
        className="grid h-[40px] w-[40px] place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)] disabled:opacity-50"
        style={{ color: "var(--accent)" }}
        aria-label={t("calls.callUser", { name: partnerName })}
      >
        <Phone size={19} />
      </button>

      <div className="relative" ref={ref}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          className="grid h-[36px] w-[36px] place-items-center rounded-full transition-colors hover:bg-[var(--background-surface)]"
          style={{ color: "var(--foreground-50)" }}
          aria-label={t("messenger.chatMenu")}
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
              <Item icon={Info} label={t("messenger.chatInfo")} onClick={goProfile} />
              {onSearch && <Item icon={Search} label={t("messenger.chatSearch")} onClick={() => { close(); onSearch(); }} />}
              <Item
                icon={dialogMeta.muted ? Bell : BellOff}
                label={dialogMeta.muted ? t("messenger.enableNotifications") : t("messenger.disableNotifications")}
                onClick={toggleMute}
              />
              <Item
                icon={dialogMeta.archived ? ArchiveRestore : Archive}
                label={dialogMeta.archived ? t("messenger.restoreFromArchive") : t("messenger.archiveChatAction")}
                onClick={toggleArchive}
              />
              <div className="border-t" style={{ borderColor: "var(--border)" }} />
              <Item
                icon={dialogMeta.blocked ? ShieldOff : Ban}
                label={dialogMeta.blocked ? t("messenger.unblock") : t("messenger.block")}
                onClick={toggleBlock}
                danger={!dialogMeta.blocked}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <ConfirmCallDialog
        open={confirmOpen}
        peerId={partnerId}
        onCancel={() => setConfirmOpen(false)}
        onConfirm={() => {
          setConfirmOpen(false);
          calls.start(partnerId);
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
