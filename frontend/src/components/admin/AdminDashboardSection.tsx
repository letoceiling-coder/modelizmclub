import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { motion } from "framer-motion";
import { Users, Megaphone, Newspaper, ShieldCheck, UserPlus } from "lucide-react";
import { formatDate } from "@/lib/format/date";
import {
  fetchDashboard,
  fetchModeratorDashboardStats,
  fetchAuditLogs,
  type AdminUserRow,
  type AuditEntry,
} from "@/lib/api/admin";
import { H, card, type AdminRole } from "@/components/admin/adminShared";

export function Dashboard({ role }: { role: AdminRole }) {
  const { t } = useTranslation();
  const [data, setData] = useState<Awaited<ReturnType<typeof fetchDashboard>> | null>(null);
  const [audit, setAudit] = useState<AuditEntry[]>([]);

  useEffect(() => {
    let active = true;
    if (role === "admin") {
      fetchDashboard()
        .then((d) => active && setData(d))
        .catch(() => {});
      fetchAuditLogs()
        .then((a) => active && setAudit(a))
        .catch(() => {});
    } else {
      fetchModeratorDashboardStats()
        .then((stats) => {
          if (!active) return;
          setData({
            usersTotal: 0,
            postsTotal: 0,
            communitiesTotal: 0,
            moderationPending: stats.moderationPending,
            reportsPending: stats.reportsPending,
            plansActive: 0,
            promocodesActive: 0,
            bannersActive: 0,
          });
        })
        .catch(() => {});
    }
    return () => {
      active = false;
    };
  }, [role]);

  const allStats = [
    {
      v: (data?.usersTotal ?? 0).toLocaleString("ru"),
      l: t("pages.adminDashboard.statUsers"),
      icon: Users,
      ch: "",
      up: true,
      adminOnly: true,
    },
    {
      v: (data?.communitiesTotal ?? 0).toLocaleString("ru"),
      l: t("pages.adminDashboard.statCommunities"),
      icon: Users,
      ch: "",
      up: true,
      adminOnly: true,
    },
    {
      v: (data?.bannersActive ?? 0).toLocaleString("ru"),
      l: t("pages.adminDashboard.statBanners"),
      icon: Megaphone,
      ch: "",
      up: true,
      adminOnly: true,
    },
    {
      v: (data?.postsTotal ?? 0).toLocaleString("ru"),
      l: t("pages.adminDashboard.statPosts"),
      icon: Newspaper,
      ch: "",
      up: true,
      adminOnly: true,
    },
    {
      v: String(data?.moderationPending ?? 0),
      l: t("pages.adminDashboard.statModeration"),
      icon: ShieldCheck,
      ch: "",
      up: true,
      warn: true,
      adminOnly: false,
    },
    {
      v: String(data?.reportsPending ?? 0),
      l: t("pages.adminDashboard.statReports"),
      icon: UserPlus,
      ch: "",
      up: true,
      adminOnly: false,
    },
  ];
  const stats = allStats.filter((s) => role === "admin" || !s.adminOnly);
  const bars = [40, 65, 55, 80, 70, 90, 60];
  const dayKeys = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"] as const;

  return (
    <div>
      <H>{t("pages.adminDashboard.title")}</H>
      <motion.div
        initial="hidden"
        animate="visible"
        variants={{ hidden: {}, visible: { transition: { staggerChildren: 0.05 } } }}
        className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6"
        style={{ gap: "12px" }}
      >
        {stats.map((s, i) => (
          <motion.div
            key={i}
            variants={{ hidden: { opacity: 0, y: 16 }, visible: { opacity: 1, y: 0 } }}
            style={{ ...card, padding: "16px" }}
          >
            <div
              style={{
                width: "36px",
                height: "36px",
                borderRadius: "var(--r-pill)",
                background: s.warn ? "var(--warning-soft)" : "var(--accent-soft)",
                display: "grid",
                placeItems: "center",
                marginBottom: "12px",
              }}
            >
              <s.icon size={18} style={{ color: s.warn ? "var(--warning)" : "var(--accent)" }} />
            </div>
            <div
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 800,
                fontSize: "28px",
                color: "var(--foreground)",
              }}
            >
              {s.v}
            </div>
            <div
              style={{
                fontSize: "12px",
                color: "var(--foreground-50)",
                textTransform: "uppercase",
                letterSpacing: "0.5px",
                marginTop: "4px",
              }}
            >
              {s.l}
            </div>
            {s.ch && (
              <div
                style={{
                  fontSize: "11px",
                  fontWeight: 500,
                  color: "var(--success)",
                  marginTop: "2px",
                }}
              >
                {s.ch} ↑
              </div>
            )}
          </motion.div>
        ))}
      </motion.div>

      {role === "admin" && (
        <>
          {/* Chart */}
          <div style={{ ...card, padding: "20px", marginTop: "20px" }}>
            <h4
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "16px",
                color: "var(--foreground)",
              }}
            >
              {t("pages.adminDashboard.registrationsChart")}
            </h4>
            <div
              style={{
                height: "200px",
                display: "flex",
                alignItems: "flex-end",
                justifyContent: "center",
                gap: "16px",
                marginTop: "16px",
              }}
            >
              {bars.map((h, i) => (
                <div
                  key={i}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "8px",
                    height: "100%",
                  }}
                >
                  <div style={{ flex: 1, display: "flex", alignItems: "flex-end" }}>
                    <motion.div
                      initial={{ height: 0 }}
                      animate={{ height: `${h}%` }}
                      transition={{ duration: 0.6, delay: i * 0.05, ease: [0.22, 1, 0.36, 1] }}
                      style={{
                        width: "36px",
                        background: "var(--accent)",
                        borderRadius: "4px 4px 0 0",
                        minHeight: "4px",
                      }}
                    />
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>
                    {t(`pages.adminDashboard.days.${dayKeys[i]}`)}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Recent actions */}
          <div style={{ ...card, marginTop: "20px" }}>
            <h4
              style={{
                fontFamily: "var(--font-display)",
                fontWeight: 600,
                fontSize: "16px",
                color: "var(--foreground)",
                padding: "16px 16px 8px",
              }}
            >
              {t("pages.adminDashboard.recentActions")}
            </h4>
            <div style={{ overflowX: "auto" }}>
              <table className="w-full" style={{ fontSize: "13px", minWidth: "600px" }}>
                <tbody>
                  {audit.map((a) => (
                    <tr key={a.id} style={{ borderTop: "1px solid var(--border)" }}>
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "var(--foreground)",
                          fontWeight: 500,
                        }}
                      >
                        {a.user}
                      </td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                        {a.action}
                      </td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                        {a.target}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "var(--foreground-30)",
                          fontSize: "12px",
                          textAlign: "right",
                        }}
                      >
                        {a.time}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ============ USERS ============ */
const SUBSCRIPTION_LABEL: Record<
  AdminUserRow["subscription"]["status"],
  { label: string; color: string }
> = {
  active: { label: "Активна", color: "var(--success)" },
  expired: { label: "Истекла", color: "var(--warning)" },
  cancelled: { label: "Неактивна", color: "var(--foreground-50)" },
  none: { label: "Нет", color: "var(--foreground-50)" },
};

export function SubscriptionCell({
  user,
  busy,
  onChange,
}: {
  user: AdminUserRow;
  busy: boolean;
  onChange: (action: "activate" | "extend" | "deactivate", days?: number) => void;
}) {
  const [days, setDays] = useState(365);
  const meta = SUBSCRIPTION_LABEL[user.subscription.status];
  const endsAt = user.subscription.endsAt ? formatDate(user.subscription.endsAt, "date") : null;

  const actionStyle: CSSProperties = {
    fontSize: "11px",
    height: "24px",
    padding: "0 8px",
    borderRadius: "var(--r-card-sm)",
    border: "1px solid var(--border)",
    background: "var(--background-surface)",
    color: "var(--foreground-70)",
    opacity: busy ? 0.5 : 1,
  };

  return (
    <div className="flex flex-col" style={{ gap: "6px" }}>
      <span style={{ color: meta.color, fontWeight: 600 }}>{meta.label}</span>
      {endsAt && (
        <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>до {endsAt}</span>
      )}
      <div className="flex flex-wrap items-center" style={{ gap: "4px" }}>
        <input
          type="number"
          min={1}
          max={3650}
          value={days}
          onChange={(e) => setDays(Math.max(1, Number(e.target.value) || 1))}
          className="outline-none"
          style={{ ...actionStyle, width: "60px", padding: "0 6px" }}
          aria-label="Дней"
        />
        <button
          type="button"
          disabled={busy}
          onClick={() => onChange("activate", days)}
          style={actionStyle}
        >
          Активировать
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => onChange("extend", days)}
          style={actionStyle}
        >
          Продлить
        </button>
        {user.subscription.isActive && (
          <button
            type="button"
            disabled={busy}
            onClick={() => onChange("deactivate")}
            style={actionStyle}
          >
            Снять
          </button>
        )}
      </div>
    </div>
  );
}
