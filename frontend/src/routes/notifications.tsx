import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck, UserPlus, Megaphone, MessageSquare, Phone } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { EmptyState } from "@/components/ui/empty-state";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatRelativeTime } from "@/lib/mock";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api/notifications";
import { onRealtimeNotification } from "@/lib/realtime/user";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Уведомления — МоДелизМ" }] }),
  beforeLoad: async ({ location }) => {
    const { requireAuth } = await import("@/lib/auth/requireAuth");
    await requireAuth(location);
  },
  component: NotificationsPage,
});

function iconFor(type: string) {
  if (type === "friend_request" || type === "friend_accept") return UserPlus;
  if (type === "message") return MessageSquare;
  if (type === "call") return Phone;
  if (type === "system") return Megaphone;
  return Bell;
}

function NotificationsPage() {
  const nav = useNavigate();
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchNotifications()
      .then((r) => setItems(r.items))
      .catch(() => toast.error("Не удалось загрузить уведомления"))
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
      toast.success("Все прочитаны");
    } catch {
      toast.error("Не удалось обновить");
    }
  };

  return (
    <AppLayout footer>
      <div className="mx-auto w-full max-w-[640px] px-[8px] py-[16px]">
        <div className="mb-[16px] flex items-center justify-between">
          <div className="flex items-center gap-[10px]">
            <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "22px", color: "var(--foreground)" }}>
              Уведомления
            </h1>
            {unread > 0 && (
              <span
                className="inline-flex h-[22px] min-w-[22px] items-center justify-center px-[6px] text-[11px] font-bold"
                style={{ background: "var(--accent)", color: "white", borderRadius: 999 }}
              >
                {unread}
              </span>
            )}
          </div>
          {unread > 0 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={markAll}
              className="gap-[6px] rounded-[8px] text-[13px]"
              style={{ color: "var(--accent)" }}
            >
              <CheckCheck size={15} /> Прочитать все
            </Button>
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
            title="Пока нет уведомлений"
            description="Здесь будут появляться уведомления о новых активностях"
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
                  </Card>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
