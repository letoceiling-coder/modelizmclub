import { Fragment, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { fetchAuditLogPage, type AuditLogDetailEntry } from "@/lib/api/admin";
import { H, card, inputStyle } from "@/components/admin/adminShared";

export function AuditLogSection() {
  const { t } = useTranslation();
  const auditColumns = useMemo(
    () => [
      t("pages.adminAuditLog.columns.who"),
      t("pages.adminAuditLog.columns.when"),
      t("pages.adminAuditLog.columns.action"),
      t("pages.adminAuditLog.columns.entity"),
    ],
    [t],
  );
  const [page, setPage] = useState(1);
  const [entries, setEntries] = useState<AuditLogDetailEntry[]>([]);
  const [lastPage, setLastPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState("all");
  const [actionFilter, setActionFilter] = useState("all");

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAuditLogPage(page)
      .then((r) => {
        if (!active) return;
        setEntries(r.entries);
        setLastPage(r.lastPage);
      })
      .catch(() => active && setEntries([]))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [page]);

  const userOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.user))).sort(),
    [entries],
  );
  const actionPrefixOptions = useMemo(
    () => Array.from(new Set(entries.map((e) => e.action.split(".")[0]).filter(Boolean))).sort(),
    [entries],
  );

  const filtered = entries.filter((e) => {
    const matchUser = userFilter === "all" || e.user === userFilter;
    const matchAction = actionFilter === "all" || e.action.startsWith(actionFilter + ".");
    return matchUser && matchAction;
  });

  const renderDiffValue = (v: unknown): string => {
    if (v === null || v === undefined) return "—";
    if (typeof v === "object") return JSON.stringify(v);
    return String(v);
  };

  const renderDiff = (entry: AuditLogDetailEntry) => {
    const oldV = entry.oldValues ?? {};
    const newV = entry.newValues ?? {};
    const keys = Array.from(new Set([...Object.keys(oldV), ...Object.keys(newV)]));
    if (keys.length === 0) {
      return (
        <p style={{ fontSize: 12, color: "var(--foreground-50)" }}>
          {t("pages.adminAuditLog.noDiff")}
        </p>
      );
    }
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {keys.map((k) => (
          <div key={k} style={{ fontSize: 12, color: "var(--foreground-70)" }}>
            <span style={{ fontWeight: 600, color: "var(--foreground)" }}>{k}</span>
            {": "}
            {renderDiffValue((oldV as Record<string, unknown>)[k])}
            {" → "}
            <span style={{ color: "var(--accent)" }}>
              {renderDiffValue((newV as Record<string, unknown>)[k])}
            </span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div>
      <H>{t("pages.adminAuditLog.title")}</H>
      <div className="flex flex-wrap" style={{ gap: "12px", marginBottom: "16px" }}>
        <select
          value={userFilter}
          onChange={(e) => setUserFilter(e.target.value)}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">{t("pages.adminAuditLog.allUsers")}</option>
          {userOptions.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <select
          value={actionFilter}
          onChange={(e) => setActionFilter(e.target.value)}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">{t("pages.adminAuditLog.allActions")}</option>
          {actionPrefixOptions.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
        </select>
      </div>

      <div style={{ ...card, overflow: "hidden" }}>
        {loading ? (
          <p style={{ padding: 16, fontSize: 13, color: "var(--foreground-50)" }}>
            {t("pages.adminCommon.loading")}
          </p>
        ) : filtered.length === 0 ? (
          <p style={{ padding: 16, fontSize: 13, color: "var(--foreground-50)" }}>
            {t("pages.adminAuditLog.empty")}
          </p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="w-full" style={{ fontSize: "13px", minWidth: "700px" }}>
              <thead>
                <tr style={{ background: "var(--background-surface)" }}>
                  {auditColumns.map((h) => (
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
                {filtered.map((e) => (
                  <Fragment key={e.id}>
                    <tr
                      onClick={() => setExpandedId(expandedId === e.id ? null : e.id)}
                      style={{ borderTop: "1px solid var(--border)", cursor: "pointer" }}
                    >
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "var(--foreground)",
                          fontWeight: 500,
                        }}
                      >
                        {e.user}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "var(--foreground-30)",
                          fontSize: "12px",
                        }}
                        title={e.time}
                      >
                        {e.time}
                      </td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                        {e.action}
                      </td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                        {e.target}
                      </td>
                    </tr>
                    {expandedId === e.id && (
                      <tr style={{ background: "var(--background-surface)" }}>
                        <td colSpan={4} style={{ padding: "12px 16px" }}>
                          {renderDiff(e)}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between" style={{ marginTop: "12px" }}>
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page <= 1}
          style={{
            fontSize: 13,
            padding: "6px 14px",
            borderRadius: "var(--r-card-sm)",
            border: "1px solid var(--border)",
            color: "var(--foreground-70)",
            opacity: page <= 1 ? 0.5 : 1,
          }}
        >
          {t("pages.adminAuditLog.prev")}
        </button>
        <span style={{ fontSize: 12, color: "var(--foreground-50)" }}>
          {t("pages.adminAuditLog.page", { page, last: lastPage })}
        </span>
        <button
          onClick={() => setPage((p) => Math.min(lastPage, p + 1))}
          disabled={page >= lastPage}
          style={{
            fontSize: 13,
            padding: "6px 14px",
            borderRadius: "var(--r-card-sm)",
            border: "1px solid var(--border)",
            color: "var(--foreground-70)",
            opacity: page >= lastPage ? 0.5 : 1,
          }}
        >
          {t("pages.adminAuditLog.next")}
        </button>
      </div>
    </div>
  );
}
