import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, Ban, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import { StatusBadge } from "@/components/StatusBadge";
import { useCurrentUser } from "@/lib/session";
import {
  fetchAdminUsers,
  updateAdminUser,
  deleteAdminUser,
  setAdminUserSubscription,
  type AdminUserRow,
} from "@/lib/api/admin";
import { H, card, inputStyle, IconBtn } from "@/components/admin/adminShared";
import { SubscriptionCell } from "@/components/admin/AdminDashboardSection";

export function UsersSection() {
  const { t } = useTranslation();
  const me = useCurrentUser();
  const roleOptions = useMemo(
    () => [
      { value: "user" as const, label: t("pages.adminUsers.roleUser") },
      { value: "subscriber" as const, label: t("pages.adminUsers.roleSubscriber") },
      { value: "moderator" as const, label: t("pages.adminUsers.roleModerator") },
      { value: "admin" as const, label: t("pages.adminUsers.roleAdmin") },
    ],
    [t],
  );
  const [query, setQuery] = useState("");
  const [role, setRole] = useState<"all" | AdminUserRow["role"]>("all");
  const [users, setUsers] = useState<AdminUserRow[]>([]);
  const [savingRole, setSavingRole] = useState<string | null>(null);
  const [savingSubscription, setSavingSubscription] = useState<string | null>(null);
  const [deletingUuid, setDeletingUuid] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    fetchAdminUsers({ role })
      .then((list) => active && setUsers(list))
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [role]);

  const changeRole = async (uuid: string, newRole: AdminUserRow["role"]) => {
    const target = users.find((u) => u.uuid === uuid);
    if (!target || target.role === newRole) return;
    if (me.id === uuid) {
      toast.error(t("pages.adminUsers.cannotChangeOwnRole"));
      return;
    }
    setSavingRole(uuid);
    try {
      await updateAdminUser(uuid, { role: newRole });
      setUsers((prev) => prev.map((u) => (u.uuid === uuid ? { ...u, role: newRole } : u)));
      toast.success(
        newRole === "admin"
          ? t("pages.adminUsers.roleAdminAssigned")
          : t("pages.adminUsers.roleUpdated"),
      );
    } catch {
      toast.error(t("pages.adminUsers.roleChangeFailed"));
    } finally {
      setSavingRole(null);
    }
  };

  const changeSubscription = async (
    uuid: string,
    action: "activate" | "extend" | "deactivate",
    days?: number,
  ) => {
    setSavingSubscription(uuid);
    try {
      const subscription = await setAdminUserSubscription(uuid, action, days);
      setUsers((prev) => prev.map((u) => (u.uuid === uuid ? { ...u, subscription } : u)));
      toast.success(action === "deactivate" ? "Подписка снята" : "Подписка обновлена");
    } catch (err) {
      toast.error(formatApiErrorMessage(err, "Не удалось изменить подписку"));
    } finally {
      setSavingSubscription(null);
    }
  };

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return users.filter((u) => {
      const matchQ = !q || u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
      const matchR = role === "all" || u.role === role;
      return matchQ && matchR;
    });
  }, [users, query, role]);

  const toggle = async (uuid: string) => {
    const target = users.find((u) => u.uuid === uuid);
    if (!target) return;
    const ns = target.status === "active" ? "blocked" : "active";
    try {
      await updateAdminUser(uuid, { status: ns });
      setUsers((prev) => prev.map((u) => (u.uuid === uuid ? { ...u, status: ns } : u)));
      toast.success(
        ns === "blocked" ? t("pages.adminUsers.userBlocked") : t("pages.adminUsers.userUnblocked"),
      );
    } catch {
      toast.error(t("pages.adminUsers.statusChangeFailed"));
    }
  };

  const remove = async (uuid: string) => {
    const target = users.find((u) => u.uuid === uuid);
    if (!target) return;
    if (me.id === uuid) {
      toast.error(t("pages.adminUsers.cannotDeleteSelf"));
      return;
    }
    if (!window.confirm(t("pages.adminUsers.deleteConfirm", { email: target.email }))) return;
    setDeletingUuid(uuid);
    try {
      await deleteAdminUser(uuid);
      setUsers((prev) => prev.filter((u) => u.uuid !== uuid));
      toast.success(t("pages.adminUsers.userDeleted"));
    } catch {
      toast.error(t("pages.adminUsers.deleteFailed"));
    } finally {
      setDeletingUuid(null);
    }
  };

  const roleBadge = (r: AdminUserRow["role"]) => {
    const map: Record<AdminUserRow["role"], { bg: string; c: string; l: string }> = {
      admin: { bg: "var(--accent-soft)", c: "var(--accent)", l: t("pages.adminUsers.roleAdmin") },
      moderator: {
        bg: "var(--info-soft)",
        c: "var(--info)",
        l: t("pages.adminUsers.roleModerator"),
      },
      subscriber: {
        bg: "var(--success-soft)",
        c: "var(--success)",
        l: t("pages.adminUsers.roleSubscriber"),
      },
      user: {
        bg: "var(--background-surface)",
        c: "var(--foreground-50)",
        l: t("pages.adminUsers.roleUserShort"),
      },
    };
    const s = map[r];
    return (
      <span
        style={{
          fontSize: "11px",
          fontWeight: 500,
          padding: "2px 8px",
          borderRadius: "var(--r-tag)",
          background: s.bg,
          color: s.c,
        }}
      >
        {s.l}
      </span>
    );
  };

  return (
    <div>
      <H>{t("pages.adminUsers.title")}</H>
      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("pages.adminUsers.searchPlaceholder")}
          className="outline-none"
          style={{ ...inputStyle, width: "320px", maxWidth: "100%" }}
        />
        <select
          value={role}
          onChange={(e) => setRole(e.target.value as "all" | AdminUserRow["role"])}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">{t("pages.adminUsers.allRoles")}</option>
          <option value="user">{t("pages.adminUsers.roleUser")}</option>
          <option value="subscriber">{t("pages.adminUsers.roleSubscriber")}</option>
          <option value="moderator">{t("pages.adminUsers.roleModerator")}</option>
          <option value="admin">{t("pages.adminUsers.roleAdmin")}</option>
        </select>
      </div>

      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "780px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                {[
                  t("pages.adminCommon.colName"),
                  t("pages.adminCommon.colEmail"),
                  t("pages.adminCommon.colCity"),
                  t("pages.adminCommon.colSubscription"),
                  t("pages.adminCommon.colRole"),
                  t("pages.adminCommon.colStatus"),
                  t("pages.adminCommon.colActions"),
                ].map((h) => (
                  <th
                    key={h}
                    style={{
                      padding: "10px 16px",
                      textAlign: "left",
                      fontSize: "11px",
                      fontWeight: 600,
                      color: "var(--foreground-50)",
                      textTransform: "uppercase",
                      letterSpacing: "1px",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u) => (
                <tr key={u.uuid} style={{ borderTop: "1px solid var(--border)" }}>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex items-center gap-[10px]">
                      <div
                        style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "var(--r-pill)",
                          background: "var(--accent-soft)",
                          color: "var(--accent)",
                          display: "grid",
                          placeItems: "center",
                          fontSize: "12px",
                          fontWeight: 700,
                        }}
                      >
                        {u.name.slice(0, 1).toUpperCase()}
                      </div>
                      <span style={{ color: "var(--foreground)", fontWeight: 500 }}>{u.name}</span>
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>{u.email}</td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                    {u.city || "—"}
                  </td>
                  <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                    <SubscriptionCell
                      user={u}
                      busy={savingSubscription === u.uuid}
                      onChange={(action, days) => changeSubscription(u.uuid, action, days)}
                    />
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex flex-col" style={{ gap: "6px" }}>
                      {roleBadge(u.role)}
                      <select
                        value={u.role}
                        disabled={me.id === u.uuid || savingRole === u.uuid}
                        onChange={(e) => changeRole(u.uuid, e.target.value as AdminUserRow["role"])}
                        className="outline-none"
                        title={
                          me.id === u.uuid
                            ? t("pages.adminUsers.cannotChangeOwnRole")
                            : t("pages.adminUsers.changeRoleTitle")
                        }
                        style={{
                          fontSize: "12px",
                          height: "28px",
                          padding: "0 8px",
                          borderRadius: "var(--r-card-sm)",
                          border: "1px solid var(--border)",
                          background: "var(--background-surface)",
                          color: "var(--foreground-70)",
                          opacity: me.id === u.uuid ? 0.5 : 1,
                        }}
                      >
                        {roleOptions.map((o) => (
                          <option key={o.value} value={o.value}>
                            {o.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <StatusBadge variant={u.status === "active" ? "published" : "rejected"}>
                      {u.status === "active"
                        ? t("pages.adminUsers.statusActive")
                        : u.status === "blocked"
                          ? t("pages.adminUsers.statusBlocked")
                          : t("pages.adminUsers.statusPending")}
                    </StatusBadge>
                  </td>
                  <td style={{ padding: "10px 16px" }}>
                    <div className="flex gap-[6px]">
                      <IconBtn
                        onClick={() =>
                          toast.info(t("pages.adminUsers.previewToast", { name: u.name }))
                        }
                      >
                        <Eye size={14} />
                      </IconBtn>
                      <IconBtn danger onClick={() => toggle(u.uuid)}>
                        <Ban size={14} />
                      </IconBtn>
                      <IconBtn
                        danger
                        onClick={() => remove(u.uuid)}
                        title={
                          me.id === u.uuid
                            ? t("pages.adminUsers.cannotDeleteSelf")
                            : t("pages.adminCommon.actionDelete")
                        }
                      >
                        <Trash2 size={14} style={{ opacity: deletingUuid === u.uuid ? 0.4 : 1 }} />
                      </IconBtn>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
