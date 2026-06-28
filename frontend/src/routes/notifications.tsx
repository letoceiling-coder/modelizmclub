import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { motion } from "framer-motion";
import { Bell, CheckCheck, UserPlus, Megaphone } from "lucide-react";
import { toast } from "sonner";
import { AppLayout } from "@/components/layout/AppLayout";
import { formatRelativeTime } from "@/lib/mock";
import {
  fetchNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type AppNotification,
} from "@/lib/api/notifications";

export const Route = createFileRoute("/notifications")({
  head: () => ({ meta: [{ title: "Уведомления — МоДелизМ Форум" }] }),
  component: NotificationsPage,
});

function iconFor(type: string) {
  if (type === "friend_request" || type === "friend_accept") return UserPlus;
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
    <AppLayout>
      <div className="mx-auto w-full max-w-[640px] px-[8px] py-[16px]">
        <div className="mb-[16px] flex items-center justify-between">
          <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "22px", color: "var(--foreground)" }}>
            Уведомления
          </h1>
          {unread > 0 && (
            <button
              onClick={markAll}
              className="inline-flex items-center gap-[6px]"
              style={{ fontSize: "13px", color: "var(--accent)", fontWeight: 600 }}
            >
              <CheckCheck size={15} /> Прочитать все
            </button>
          )}
        </div>

        {loading ? (
          <p style={{ fontSize: "14px", color: "var(--foreground-50)" }}>Загрузка…</p>
        ) : items.length === 0 ? (
          <div
            className="flex flex-col items-center justify-center text-center"
            style={{ padding: "64px 16px", color: "var(--foreground-50)" }}
          >
            <Bell size={36} style={{ marginBottom: 12, opacity: 0.5 }} />
            <p style={{ fontSize: "15px" }}>Пока нет уведомлений</p>
          </div>
        ) : (
          <div className="space-y-[8px]">
            {items.map((n, i) => {
              const Icon = iconFor(n.type);
              return (
                <motion.button
                  key={n.id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: Math.min(i * 0.03, 0.3) }}
                  onClick={() => open(n)}
                  className="flex w-full items-start gap-[12px] text-left"
                  style={{
                    background: n.read ? "var(--background-surface)" : "var(--accent-soft)",
                    border: "1px solid var(--border)",
                    borderRadius: "var(--r-card-sm)",
                    padding: "12px 14px",
                  }}
                >
                  <span
                    className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-full"
                    style={{ background: "var(--background)", color: "var(--accent)" }}
                  >
                    <Icon size={17} />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div style={{ fontSize: "14px", fontWeight: 600, color: "var(--foreground)" }}>{n.title}</div>
                    {n.body && (
                      <div style={{ fontSize: "13px", color: "var(--foreground-70)", marginTop: 2 }}>{n.body}</div>
                    )}
                    {n.createdAt && (
                      <div style={{ fontSize: "11px", color: "var(--foreground-50)", marginTop: 4 }}>
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
                </motion.button>
              );
            })}
          </div>
        )}
      </div>
    </AppLayout>
  );
}
