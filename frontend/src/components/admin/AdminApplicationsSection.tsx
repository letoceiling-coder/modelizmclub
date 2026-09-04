import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { formatDate } from "@/lib/format/date";
import { CollapsibleText } from "@/components/ui/CollapsibleText";
import {
  fetchEntityRequests,
  approveEntityRequest,
  rejectEntityRequest,
  type EntityRequest,
  type RequestStatus,
  type EntityKind,
} from "@/lib/api/entity-requests";

export function ApplicationsSection() {
  const { t } = useTranslation();
  const statuses = useMemo(
    () =>
      (["pending", "approved", "rejected"] as const).map((id) => ({
        id,
        label: t(`pages.adminApplications.filters.${id}`),
      })),
    [t],
  );
  const kindLabels = useMemo(
    () =>
      ({
        channel: t("pages.adminApplications.kinds.channel"),
        community: t("pages.adminApplications.kinds.community"),
      }) as Record<EntityKind, string>,
    [t],
  );
  const [status, setStatus] = useState<RequestStatus>("pending");
  const [items, setItems] = useState<EntityRequest[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    fetchEntityRequests(status)
      .then((list) => {
        if (alive) setItems(list);
      })
      .catch(() => {
        if (alive) setItems([]);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [status]);

  const decide = async (r: EntityRequest, approve: boolean) => {
    setItems((cur) => cur.filter((x) => x.id !== r.id)); // optimistic
    try {
      if (approve) await approveEntityRequest(r.kind, r.id);
      else await rejectEntityRequest(r.kind, r.id);
    } catch {
      // на реальном бэке при ошибке перезагрузим список
      fetchEntityRequests(status)
        .then(setItems)
        .catch(() => {});
    }
  };

  return (
    <div>
      <h3
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 600,
          fontSize: "18px",
          color: "var(--foreground)",
          marginBottom: "12px",
        }}
      >
        {t("pages.adminApplications.title")}
      </h3>

      <div style={{ display: "flex", gap: "6px", marginBottom: "16px" }}>
        {statuses.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStatus(s.id)}
            style={{
              padding: "7px 14px",
              borderRadius: "9px",
              fontSize: "13px",
              fontWeight: 600,
              background: status === s.id ? "var(--accent-soft)" : "var(--background-surface)",
              color: status === s.id ? "var(--accent)" : "var(--foreground-70)",
              border: `1px solid ${status === s.id ? "var(--border-accent)" : "var(--border)"}`,
            }}
          >
            {s.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ color: "var(--foreground-50)", fontSize: "13px" }}>
          {t("pages.adminCommon.loading")}
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            padding: "32px 16px",
            textAlign: "center",
            color: "var(--foreground-50)",
            fontSize: "13px",
            border: "1px solid var(--border)",
            borderRadius: "12px",
          }}
        >
          {t("pages.adminApplications.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((r) => (
            <div
              key={r.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "16px",
                background: "var(--background-elevated)",
              }}
            >
              <div
                style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}
              >
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    padding: "2px 8px",
                    borderRadius: "6px",
                    background: "var(--accent-soft)",
                    color: "var(--accent)",
                  }}
                >
                  {kindLabels[r.kind]}
                </span>
                <span style={{ fontSize: "15px", fontWeight: 600, color: "var(--foreground)" }}>
                  {r.proposedName}
                </span>
              </div>
              <div style={{ fontSize: "13px", color: "var(--foreground-70)", marginBottom: "8px" }}>
                <Link
                  to="/user/$id"
                  params={{ id: r.applicant.slug ?? r.applicant.id }}
                  style={{ color: "var(--accent)" }}
                >
                  {r.applicant.name}
                </Link>
                {" · "}
                {r.category}
                {" · "}
                {formatDate(r.createdAt, "date")}
              </div>
              {r.description && (
                <div
                  style={{
                    marginBottom: "12px",
                    fontSize: "13px",
                    color: "var(--foreground-70)",
                    wordBreak: "break-word",
                  }}
                >
                  <CollapsibleText text={r.description} maxLines={3} />
                </div>
              )}
              {status === "pending" && (
                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => decide(r, true)}
                    style={{
                      flex: 1,
                      height: "38px",
                      borderRadius: "9px",
                      fontSize: "13px",
                      fontWeight: 600,
                      background: "var(--accent)",
                      color: "var(--accent-foreground)",
                      border: "none",
                    }}
                  >
                    {t("pages.adminCommon.actionApprove")}
                  </button>
                  <button
                    type="button"
                    onClick={() => decide(r, false)}
                    style={{
                      flex: 1,
                      height: "38px",
                      borderRadius: "9px",
                      fontSize: "13px",
                      fontWeight: 600,
                      background: "var(--background-surface)",
                      color: "var(--foreground-70)",
                      border: "1px solid var(--border)",
                    }}
                  >
                    {t("pages.adminCommon.reject")}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
