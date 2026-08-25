import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Bell, CheckCheck, Trash2, UserPlus, Megaphone, MessageSquare, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "@/lib/toast";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatRelativeTime } from "@/lib/mock";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  deleteNotification,
  clearAllNotifications,
  type AppNotification,
} from "@/lib/api/notifications";
import { onRealtimeNotification, bumpUnreadNotifications } from "@/lib/realtime/user";
import {
  trackPendingDelete,
  clearPendingDelete,
  clearAllPendingDeletes,
  flushPendingDeletes,
} from "@/lib/notifications-pending-delete";
import { isDemoMode } from "@/lib/demo-mode";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: i18n.t("pages.notifications.metaTitle") }] }),
  component: NotificationsPage,
});

function iconFor(type: string) {
  if (type === "friend_request" || type === "friend_accept" || type === "friend_requests" || type === "followers") return UserPlus;
  if (type === "message" || type === "messages" || type === "comments") return MessageSquare;
  if (type === "call" || type === "calls") return Phone;
  if (type === "system" || type === "moderation" || type === "promo" || type === "listings" || type === "deals") return Megaphone;
  return Bell;
}

function NotificationItem({
  n,
  onOpen,
  onDelete,
}: {
  n: AppNotification;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const { t } = useTranslation();
  const Icon = iconFor(n.type);

  return (
    <Card
      className="group flex w-full cursor-pointer items-start gap-[12px] p-[12px] shadow-none transition-colors hover:bg-[color-mix(in_oklab,var(--background-surface)_92%,var(--foreground)_8%)]"
      style={{
        background: n.read ? "var(--background-surface)" : "var(--accent-soft)",
        borderColor: "var(--border)",
        borderRadius: "var(--r-card-sm)",
      }}
      onClick={onOpen}
      role="button"
      tabIndex={0}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpen();
      }}
    >
      <span
        className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full"
        style={{ background: "var(--background)", color: "var(--accent)" }}
      >
        <Icon size={17} />
      </span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold" style={{ fontSize: "14px", color: "var(--foreground)" }}>
          {n.title}
        </div>
        {n.body && (
          <div className="mt-[2px] line-clamp-2" style={{ fontSize: "13px", color: "var(--foreground-70)" }}>
            {n.body}
          </div>
        )}
        {n.createdAt && (
          <div className="mt-[4px]" style={{ fontSize: "11px", color: "var(--foreground-50)" }}>
            {formatRelativeTime(n.createdAt)}
          </div>
        )}
      </div>
      {!n.read && (
        <span
          className="mt-[6px] h-[8px] w-[8px] shrink-0 rounded-full group-hover:hidden"
          style={{ background: "var(--accent)" }}
        />
      )}
      <button
        type="button"
        aria-label={t("pages.notifications.deleteAria")}
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
        className="mt-[2px] grid h-[32px] w-[32px] shrink-0 place-items-center rounded-[8px] opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
        style={{
          color: "var(--error)",
          background: "color-mix(in oklab, var(--error) 12%, transparent)",
        }}
      >
        <Trash2 size={16} />
      </button>
    </Card>
  );
}

function NotificationsPage() {
  const { t } = useTranslation();
  const router = useRouter();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);
  const pendingDeletes = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    return () => {
      for (const [id, timer] of pendingDeletes.current.entries()) {
        clearTimeout(timer);
        pendingDeletes.current.delete(id);
        void deleteNotification(id)
          .catch(() => {})
          .finally(() => clearPendingDelete(id));
      }
    };
  }, []);

  useEffect(() => {
    let alive = true;
    (async () => {
      if (!isDemoMode()) {
        await flushPendingDeletes(deleteNotification);
      }
      if (!alive) return;
      try {
        const r = await fetchNotifications();
        if (!alive) return;
        setItems(r.items);
      } catch {
        if (alive) toast.error(t("pages.notifications.loadFailed"));
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [t]);

  useEffect(() => {
    return onRealtimeNotification((n) => {
      setItems((prev) => {
        if (prev.some((x) => x.id === n.id)) return prev;
        return [n, ...prev];
      });
    });
  }, []);

  const unread = items.filter((n) => !n.read).length;

  const open = async (n: AppNotification) => {
    if (!n.read) {
      setItems((prev) => prev.map((x) => (x.id === n.id ? { ...x, read: true } : x)));
      markNotificationRead(n.id).catch(() => {});
    }
    if (n.link) {
      const url = n.link.startsWith("/") ? n.link : `/${n.link}`;
      router.history.push(url);
    }
  };

  const markAll = async () => {
    setItems((prev) => prev.map((x) => ({ ...x, read: true })));
    try {
      await markAllNotificationsRead();
      toast.success(t("pages.notifications.allRead"));
    } catch {
      toast.error(t("pages.notifications.updateFailed"));
    }
  };

  const removeOne = (id: string) => {
    const index = items.findIndex((x) => x.id === id);
    const removed = items[index];
    if (!removed) return;

    const existingTimer = pendingDeletes.current.get(id);
    if (existingTimer) clearTimeout(existingTimer);

    setItems((prev) => prev.filter((x) => x.id !== id));

    const UNDO_MS = 5000;
    let undone = false;
    const expiresAt = Date.now() + UNDO_MS;
    if (!isDemoMode()) trackPendingDelete(id, expiresAt);

    const timer = setTimeout(async () => {
      pendingDeletes.current.delete(id);
      if (undone) return;
      try {
        await deleteNotification(id);
        clearPendingDelete(id);
        if (!removed.read) bumpUnreadNotifications();
      } catch {
        toast.error(t("pages.notifications.deleteFailed"));
        clearPendingDelete(id);
        setItems((prev) => {
          if (prev.some((x) => x.id === id)) return prev;
          const next = [...prev];
          next.splice(Math.min(index, next.length), 0, removed);
          return next;
        });
      }
    }, UNDO_MS);

    pendingDeletes.current.set(id, timer);

    toast.success(t("pages.notifications.deleted"), {
      duration: UNDO_MS,
      action: {
        label: t("pages.notifications.undo"),
        onClick: () => {
          undone = true;
          clearTimeout(timer);
          pendingDeletes.current.delete(id);
          clearPendingDelete(id);
          setItems((prev) => {
            if (prev.some((x) => x.id === id)) return prev;
            const next = [...prev];
            next.splice(Math.min(index, next.length), 0, removed);
            return next;
          });
        },
      },
    });
  };

  const clearAll = async () => {
    const prev = items;
    for (const timer of pendingDeletes.current.values()) clearTimeout(timer);
    pendingDeletes.current.clear();
    clearAllPendingDeletes();
    setItems([]);
    try {
      await clearAllNotifications();
      bumpUnreadNotifications();
      toast.success(t("pages.notifications.cleared"));
    } catch {
      setItems(prev);
      toast.error(t("pages.notifications.clearFailed"));
    }
  };

  return (
    <AppLayout footer>
      <div className="mx-auto w-full max-w-[640px] px-[8px] py-[16px]">
        <div className="mb-[16px] flex flex-col gap-[10px] sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-[10px]">
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "22px", color: "var(--foreground)" }}>
              {t("pages.notifications.title")}
            </h1>
            {unread > 0 && (
              <span
                className="inline-flex h-[22px] min-w-[22px] items-center justify-center px-[6px] text-[11px] font-bold"
                style={{ background: "var(--accent)", color: "white", borderRadius: "var(--r-pill)" }}
              >
                {unread}
              </span>
            )}
          </div>
          {items.length > 0 && (
            <div className="flex flex-wrap items-center gap-[4px] sm:justify-end">
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAll}
                  className="gap-[6px] rounded-[8px] text-[13px]"
                  style={{ color: "var(--accent)" }}
                  aria-label={t("pages.notifications.markAllRead")}
                >
                  <CheckCheck size={15} />
                  <span className="hidden min-[360px]:inline">{t("pages.notifications.markAllRead")}</span>
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="gap-[6px] rounded-[8px] text-[13px]"
                style={{ color: "var(--foreground-50)" }}
                aria-label={t("pages.notifications.clearAll")}
              >
                <Trash2 size={15} />
                <span className="hidden min-[360px]:inline">{t("pages.notifications.clearAll")}</span>
              </Button>
            </div>
          )}
        </div>

        {loading ? (
          <div className="space-y-[8px]">
            {Array.from({ length: 4 }).map((_, i) => (
              <Card
                key={i}
                className="flex items-center gap-[12px] p-[12px] shadow-none"
                style={{
                  background: "var(--background-surface)",
                  borderColor: "var(--border)",
                  borderRadius: "var(--r-card-sm)",
                }}
              >
                <Skeleton className="h-[36px] w-[36px] shrink-0 rounded-full" />
                <div className="flex-1 space-y-[8px]">
                  <Skeleton className="h-[12px]" style={{ width: `${45 + (i * 13) % 35}%` }} />
                  <Skeleton className="h-[11px]" style={{ width: `${55 + (i * 9) % 30}%` }} />
                </div>
              </Card>
            ))}
          </div>
        ) : items.length === 0 ? (
          <EmptyState
            icon={Bell}
            title={t("pages.notifications.emptyTitle")}
            description={t("pages.notifications.emptyDesc")}
            variant="compact"
          />
        ) : (
          <div className="space-y-[8px]">
            {items.map((n, i) => (
              <motion.div
                key={n.id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: Math.min(i * 0.03, 0.3) }}
              >
                <NotificationItem
                  n={n}
                  onOpen={() => open(n)}
                  onDelete={() => removeOne(n.id)}
                />
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
