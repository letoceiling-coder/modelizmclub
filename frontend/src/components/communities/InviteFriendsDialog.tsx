import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Check, Loader2, UserPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { EmptyState } from "@/components/ui/empty-state";
import {
  COMMUNITY_INVITE_MAX,
  fetchInvitableFriends,
  inviteToCommunity,
  type InvitableFriend,
} from "@/lib/api/communities";
import { toast } from "@/lib/toast";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  slug: string;
  communityName: string;
}

/**
 * Выбор друзей для приглашения.
 *
 * Список приходит уже отфильтрованным: сервер убирает тех, кто в сообществе.
 * Здесь остаётся выбор и потолок в двадцать человек за раз — тот же, что
 * стоит на сервере, чтобы отказ не приходил после нажатия.
 */
export function InviteFriendsDialog({ open, onOpenChange, slug, communityName }: Props) {
  const { t } = useTranslation();
  const [friends, setFriends] = useState<InvitableFriend[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (!open) return;
    let alive = true;
    setLoading(true);
    setFailed(false);
    setSelected(new Set());
    fetchInvitableFriends(slug)
      .then((list) => alive && setFriends(list))
      .catch(() => alive && setFailed(true))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, [open, slug]);

  const toggle = (uuid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) {
        next.delete(uuid);
        return next;
      }
      if (next.size >= COMMUNITY_INVITE_MAX) {
        toast.error(t("pages.communityDetail.inviteLimit", { count: COMMUNITY_INVITE_MAX }));
        return prev;
      }
      next.add(uuid);
      return next;
    });
  };

  const send = async () => {
    if (selected.size === 0 || sending) return;
    setSending(true);
    try {
      const sent = await inviteToCommunity(slug, [...selected]);
      toast.success(t("pages.communityDetail.inviteSent", { count: sent }));
      onOpenChange(false);
    } catch {
      toast.error(t("pages.communityDetail.inviteFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle>{t("pages.communityDetail.inviteTitle")}</DialogTitle>
          <DialogDescription>
            {t("pages.communityDetail.inviteDesc", { name: communityName })}
          </DialogDescription>
        </DialogHeader>

        <div className="max-h-[46vh] overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-[32px]">
              <Loader2
                className="h-[20px] w-[20px] animate-spin"
                style={{ color: "var(--foreground-50)" }}
              />
            </div>
          ) : failed ? (
            <p
              className="py-[24px] text-center text-[14px]"
              style={{ color: "var(--foreground-50)" }}
            >
              {t("pages.communityDetail.inviteLoadFailed")}
            </p>
          ) : friends.length === 0 ? (
            <EmptyState
              icon={UserPlus}
              title={t("pages.communityDetail.inviteEmptyTitle")}
              description={t("pages.communityDetail.inviteEmptyDesc")}
            />
          ) : (
            <div className="flex flex-col">
              {friends.map((f) => {
                const on = selected.has(f.uuid);
                return (
                  <button
                    key={f.uuid}
                    type="button"
                    onClick={() => toggle(f.uuid)}
                    aria-pressed={on}
                    className="flex min-h-[56px] items-center gap-[12px] rounded-[10px] px-[8px] text-left transition-colors hover:bg-[var(--background-surface)]"
                  >
                    <UserAvatar src={f.avatar} name={f.name} size={40} />
                    <span className="min-w-0 flex-1">
                      <span
                        className="block truncate text-[14px] font-medium"
                        style={{ color: "var(--foreground)" }}
                      >
                        {f.name}
                      </span>
                      {f.city && (
                        <span
                          className="block truncate text-[12px]"
                          style={{ color: "var(--foreground-50)" }}
                        >
                          {f.city}
                        </span>
                      )}
                    </span>
                    <span
                      className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border"
                      style={{
                        borderColor: on ? "var(--accent)" : "var(--border)",
                        background: on ? "var(--accent)" : "transparent",
                      }}
                    >
                      {on && <Check size={14} style={{ color: "#fff" }} />}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-[12px]">
          <span className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
            {t("pages.communityDetail.inviteSelected", {
              count: selected.size,
              max: COMMUNITY_INVITE_MAX,
            })}
          </span>
          <Button
            type="button"
            disabled={selected.size === 0 || sending}
            onClick={() => void send()}
            className="rounded-[12px]"
          >
            {sending
              ? t("pages.communityDetail.inviteSending")
              : t("pages.communityDetail.inviteSend")}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
