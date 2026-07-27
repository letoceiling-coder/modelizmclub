import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Bell, CheckCheck, Trash2, UserPlus, Megaphone, MessageSquare, Phone, X } from "lucide-react";
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
import { onRealtimeNotification } from "@/lib/realtime/user";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: i18n.t("pages.notifications.metaTitle") }] }),
  component: NotificationsPage,
});

function iconFor(type: string) {
  if (type === "friend_request" || type === "friend_accept") return UserPlus;
  if (type === "message") return MessageSquare;
  if (type === "call") return Phone;
  if (type === "system") return Megaphone;
  return Bell;
}

function SwipeableNotification({
  children,
  onDelete,
}: {
  children: React.ReactNode;
  onDelete: () => void;
}) {
  return (
    <div className="relative overflow-hidden" style={{ borderRadius: "var(--r-card-sm)" }}>
      <div
        className="absolute inset-y-0 right-0 grid w-[72px] place-items-center"
        style={{ background: "color-mix(in oklab, var(--error) 90%, black)" }}
      >
        <Trash2 size={18} className="text-white" />
      </div>
      <motion.div
        drag="x"
        dragConstraints={{ left: -88, right: 0 }}
        dragElastic={0.08}
        onDragEnd={(_, info) => {
          if (info.offset.x < -64) onDelete();
        }}
        className="relative touch-pan-y"
        style={{ touchAction: "pan-y" }}
      >
        {children}
      </motion.div>
    </div>
  );
}

function NotificationsPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications()
      .then((r) => setItems(r.items))
      .catch(() => toast.error(t("pages.notifications.loadFailed")))
      .finally(() => setLoading(false));
  }, []);

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
    if (n.link) nav({ to: n.link });
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

  const removeOne = async (id: string) => {
    setItems((prev) => prev.filter((x) => x.id !== id));
    try {
      await deleteNotification(id);
    } catch {
      toast.error(t("pages.notifications.deleteFailed"));
      fetchNotifications().then((r) => setItems(r.items)).catch(() => {});
    }
  };

  const clearAll = async () => {
    const prev = items;
    setItems([]);
    try {
      await clearAllNotifications();
      toast.success(t("pages.notifications.cleared"));
    } catch {
      setItems(prev);
      toast.error(t("pages.notifications.clearFailed"));
    }
  };

  return (
    <AppLayout footer>
      <div className="mx-auto w-full max-w-[640px] px-[8px] py-[16px]">
        <div className="mb-[16px] flex items-center justify-between gap-[8px]">
          <div className="flex items-center gap-[10px]">
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
            <div className="flex shrink-0 items-center gap-[4px]">
              {unread > 0 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={markAll}
                  className="gap-[6px] rounded-[8px] text-[13px]"
                  style={{ color: "var(--accent)" }}
                >
                  <CheckCheck size={15} /> {t("pages.notifications.markAllRead")}
                </Button>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={clearAll}
                className="gap-[6px] rounded-[8px] text-[13px]"
                style={{ color: "var(--foreground-50)" }}
              >
                <Trash2 size={15} /> {t("pages.notifications.clearAll")}
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
            {items.map((n, i) => {
              const Icon = iconFor(n.type);
              return (
                <motion.div
                  key={n.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                >
                  <SwipeableNotification onDelete={() => void removeOne(n.id)}>
                  <Card
                    className="flex w-full cursor-pointer items-start gap-[12px] p-[12px] shadow-none transition-opacity hover:opacity-80"
                    style={{
                      background: n.read ? "var(--background-surface)" : "var(--accent-soft)",
                      borderColor: "var(--border)",
                      borderRadius: "var(--r-card-sm)",
                    }}
                    onClick={() => open(n)}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") open(n); }}
                  >
                    <span
                      className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full"
                      style={{ background: "var(--background)", color: "var(--accent)" }}
                    >
                      <Icon size={17} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div
                        className="font-semibold"
                        style={{ fontSize: "14px", color: "var(--foreground)" }}
                      >
                        {n.title}
                      </div>
                      {n.body && (
                        <div
                          className="mt-[2px] line-clamp-2"
                          style={{ fontSize: "13px", color: "var(--foreground-70)" }}
                        >
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
                        className="mt-[6px] h-[8px] w-[8px] shrink-0 rounded-full"
                        style={{ background: "var(--accent)" }}
                      />
                    )}
                    <button
                      type="button"
                      aria-label={t("pages.notifications.deleteAria")}
                      onClick={(e) => {
                        e.stopPropagation();
                        void removeOne(n.id);
                      }}
                      className="mt-[2px] grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[8px] transition-colors hover:bg-[var(--background)]"
                      style={{ color: "var(--foreground-50)" }}
                    >
                      <X size={14} />
                    </button>
                  </Card>
                  </SwipeableNotification>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
