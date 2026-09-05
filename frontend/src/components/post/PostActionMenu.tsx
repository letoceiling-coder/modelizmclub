import { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  MoreHorizontal,
  Bookmark,
  BookmarkCheck,
  Link2,
  Share2,
  EyeOff,
  Flag,
  Check,
  Trash2,
  ShieldCheck,
  Clock,
  Send,
  XCircle,
  Pencil,
} from "lucide-react";
import { toast } from "@/lib/toast";
import { actions } from "@/lib/store";
import { deletePost } from "@/lib/api/feed";
import { approveModeration } from "@/lib/api/admin";
import { isDemoMode } from "@/lib/demo-mode";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { ComplaintDialog } from "@/components/friends/ComplaintDialog";
import { useGuestAccessOptional } from "@/components/access/GuestAccessProvider";
import type { User } from "@/lib/mock";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SHARE_TARGETS, openShareTarget } from "@/lib/share-targets";

interface Props {
  postId: string;
  saved: boolean;
  title: string;
  text: string;
  status?: "published" | "moderation" | "scheduled";
  canInteract?: boolean;
  canDelete?: boolean;
  isStaff?: boolean;
  canPublishNow?: boolean;
  canReschedule?: boolean;
  canCancelSchedule?: boolean;
  /** Author of the post — used as the report target. */
  author?: User;
  /** Own post? Hide/report don't make sense on your own post. */
  isOwn?: boolean;
  onDeleted?: () => void;
  /** Shows "Редактировать" above delete. */
  onEdit?: () => void;
  /** Replaces the default delete request (channel posts delete through their own endpoint). */
  removeOverride?: () => Promise<unknown>;
  onApproved?: () => void;
  /** Toggles the saved state (shared with the footer bookmark button). */
  onToggleSave?: () => void;
  /** Hides the post from the current user's feed. */
  onHide?: () => void;
  /** Системное «Поделиться» (navigator.share, иначе копирование ссылки).
   *  Переехало сюда из панели действий карточки. */
  onShare?: () => void;
  onPublishNow?: () => void | Promise<void>;
  onReschedule?: () => void;
  onCancelSchedule?: () => void | Promise<void>;
}

export function PostActionMenu({
  postId,
  saved,
  title,
  text: _text,
  status,
  canInteract = true,
  canDelete = false,
  isStaff = false,
  author,
  isOwn = false,
  onDeleted,
  onEdit,
  removeOverride,
  onApproved,
  onToggleSave,
  onHide,
  onShare,
  canPublishNow = false,
  canReschedule = false,
  canCancelSchedule = false,
  onPublishNow,
  onReschedule,
  onCancelSchedule,
}: Props) {
  const { t } = useTranslation();
  const guest = useGuestAccessOptional();
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const [busy, setBusy] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  const showApprove = isStaff && status === "moderation";
  const showDelete = canDelete || isStaff;

  const buildUrl = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/?post=${postId}`;
  };

  const close = () => setOpen(false);

  const handleSave = () => {
    close();
    const run = () => {
      if (onToggleSave) onToggleSave();
      else actions.savePost(postId, !saved);
      toast.success(
        saved
          ? t("components.postActionMenu.savedRemoved")
          : t("components.postActionMenu.savedAdded"),
      );
    };
    if (guest) guest.guardAction("feed.post.save", run);
    else run();
  };

  const handleHide = () => {
    close();
    const run = () => {
      onHide?.();
      toast.success(t("components.postActionMenu.hidden"));
    };
    if (guest) guest.requireAccount(run);
    else run();
  };

  const handleReport = () => {
    close();
    const run = () => setReportOpen(true);
    if (guest) guest.requireAccount(run);
    else run();
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(buildUrl());
      setCopied(true);
      toast.success(t("components.postActionMenu.linkCopied"));
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error(t("components.postActionMenu.copyFailed"));
    }
  };

  const handleShareTo = (href: string) => {
    openShareTarget(href);
    close();
  };

  const handleApprove = async () => {
    if (busy) return;
    setBusy(true);
    try {
      if (isDemoMode()) {
        toast.success(t("components.postActionMenu.approved"));
        onApproved?.();
        close();
        return;
      }
      await approveModeration("posts", postId);
      toast.success(t("components.postActionMenu.approved"));
      onApproved?.();
      close();
    } catch (err) {
      toast.error(formatApiErrorMessage(err, t("components.postActionMenu.approveFailed")));
    } finally {
      setBusy(false);
    }
  };

  const handleDelete = async () => {
    if (busy) return;
    if (!window.confirm(t("components.postActionMenu.deleteConfirm"))) return;
    setBusy(true);
    try {
      if (isDemoMode()) {
        toast.success(t("components.postActionMenu.deleted"));
        onDeleted?.();
        close();
        return;
      }
      await (removeOverride ? removeOverride() : deletePost(postId));
      toast.success(t("components.postActionMenu.deleted"));
      onDeleted?.();
      close();
    } catch (err) {
      toast.error(formatApiErrorMessage(err, t("components.postActionMenu.deleteFailed")));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
        <DropdownMenuTrigger asChild>
          <button
            type="button"
            className="relative grid h-[32px] w-[32px] place-items-center rounded-[8px] hover:bg-[var(--background-surface)] before:absolute before:left-1/2 before:top-1/2 before:h-[44px] before:w-[44px] before:-translate-x-1/2 before:-translate-y-1/2 before:content-['']"
            style={{ color: "var(--foreground-70)" }}
            aria-label={t("components.postActionMenu.ariaLabel")}
          >
            <MoreHorizontal className="h-[16px] w-[16px]" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="end"
          sideOffset={6}
          className="z-[var(--z-popover)] w-[240px] overflow-hidden rounded-[12px] border p-0"
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
                label={t("components.postActionMenu.approveModeration")}
                accent
                disabled={busy}
              />
              <DropdownMenuSeparator className="m-0" style={{ background: "var(--border)" }} />
            </>
          )}
          {(canPublishNow || canReschedule || canCancelSchedule) && (
            <>
              {canPublishNow && (
                <MenuItem
                  onClick={async () => {
                    close();
                    await onPublishNow?.();
                  }}
                  icon={Send}
                  label={t("components.postActionMenu.publishNow")}
                  accent
                  disabled={busy}
                />
              )}
              {canReschedule && (
                <MenuItem
                  onClick={() => {
                    close();
                    onReschedule?.();
                  }}
                  icon={Clock}
                  label={t("components.postActionMenu.changeSchedule")}
                  disabled={busy}
                />
              )}
              {canCancelSchedule && (
                <MenuItem
                  onClick={async () => {
                    close();
                    await onCancelSchedule?.();
                  }}
                  icon={XCircle}
                  label={t("components.postActionMenu.cancelSchedule")}
                  danger
                  disabled={busy}
                />
              )}
              <DropdownMenuSeparator className="m-0" style={{ background: "var(--border)" }} />
            </>
          )}
          {onShare && (
            <MenuItem
              onClick={() => {
                close();
                onShare();
              }}
              icon={Share2}
              label={t("components.postActionMenu.share")}
            />
          )}
          {canInteract && (
            <>
              <MenuItem
                onClick={handleSave}
                icon={saved ? BookmarkCheck : Bookmark}
                label={
                  saved
                    ? t("components.postActionMenu.removeFromSaved")
                    : t("components.postActionMenu.save")
                }
                accent={saved}
              />
              <MenuItem
                onClick={handleCopy}
                icon={copied ? Check : Link2}
                label={
                  copied
                    ? t("components.postActionMenu.copied")
                    : t("components.postActionMenu.copyLink")
                }
                accent={copied}
              />
              <DropdownMenuSub>
                <DropdownMenuSubTrigger
                  className="gap-[10px] px-[14px] py-[10px] text-[13px]"
                  style={{ color: "var(--foreground)" }}
                >
                  <Share2 className="h-[16px] w-[16px]" style={{ color: "var(--foreground-70)" }} />
                  {t("components.postActionMenu.shareTo")}
                </DropdownMenuSubTrigger>
                <DropdownMenuSubContent
                  className="z-[calc(var(--z-popover)+1)] w-[200px] overflow-hidden rounded-[12px] border p-0"
                  style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
                >
                  {SHARE_TARGETS.map((target) => (
                    <MenuItem
                      key={target.id}
                      onClick={() => handleShareTo(target.href(buildUrl(), title))}
                      icon={Share2}
                      label={target.label}
                    />
                  ))}
                </DropdownMenuSubContent>
              </DropdownMenuSub>
            </>
          )}
          {canInteract && !isOwn && (
            <>
              <DropdownMenuSeparator className="m-0" style={{ background: "var(--border)" }} />
              <MenuItem
                onClick={handleHide}
                icon={EyeOff}
                label={t("components.postActionMenu.hide")}
              />
              <MenuItem
                onClick={handleReport}
                icon={Flag}
                label={t("components.postActionMenu.report")}
              />
            </>
          )}
          {onEdit && (
            <>
              <DropdownMenuSeparator className="m-0" style={{ background: "var(--border)" }} />
              <MenuItem
                onClick={onEdit}
                icon={Pencil}
                label={t("components.postActionMenu.edit")}
              />
            </>
          )}
          {showDelete && (
            <>
              <DropdownMenuSeparator className="m-0" style={{ background: "var(--border)" }} />
              <MenuItem
                onClick={handleDelete}
                icon={Trash2}
                label={t("components.postActionMenu.delete")}
                danger
                disabled={busy}
              />
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      {reportOpen && author && (
        <ComplaintDialog
          target={author}
          report={{ type: "post", targetId: postId }}
          descriptionOverride={t("components.postActionMenu.reportDescription", {
            title: title ? ` «${title}»` : "",
          })}
          page="/feed"
          subjectSuffix={t("components.postActionMenu.reportSuffix")}
          onClose={() => setReportOpen(false)}
        />
      )}
    </>
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
