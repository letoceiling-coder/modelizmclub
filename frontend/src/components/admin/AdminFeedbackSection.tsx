import { useEffect, useMemo, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Inbox } from "lucide-react";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/format/date";
import {
  fetchAdminFeedback,
  replyToAdminFeedback,
  updateAdminFeedbackStatus,
  type FeedbackRow,
  type FeedbackStatus,
} from "@/lib/api/admin";
import { H, card } from "@/components/admin/adminShared";

const FEEDBACK_FILTER_IDS = ["all", "new", "read", "resolved"] as const;
const FEEDBACK_STATUS_IDS: FeedbackStatus[] = ["new", "read", "resolved"];

export function FeedbackSection() {
  const { t } = useTranslation();
  const feedbackFilters = useMemo(
    () => FEEDBACK_FILTER_IDS.map((id) => ({ id, label: t(`pages.adminFeedback.filters.${id}`) })),
    [t],
  );
  const feedbackStatusMeta = useMemo(
    () =>
      Object.fromEntries(
        FEEDBACK_STATUS_IDS.map((id) => [
          id,
          {
            label: t(`pages.adminFeedback.status.${id}`),
            bg:
              id === "new"
                ? "var(--accent-soft)"
                : id === "read"
                  ? "var(--background-subtle)"
                  : "color-mix(in oklab, var(--success) 18%, transparent)",
            color:
              id === "new"
                ? "var(--accent)"
                : id === "read"
                  ? "var(--foreground-70)"
                  : "var(--success)",
          },
        ]),
      ) as Record<FeedbackStatus, { label: string; bg: string; color: string }>,
    [t],
  );
  const [filter, setFilter] = useState<FeedbackStatus | "all">("all");
  const [items, setItems] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);

  useEffect(() => {
    let active = true;
    setLoading(true);
    fetchAdminFeedback(filter === "all" ? undefined : filter)
      .then((rows) => active && setItems(rows))
      .catch(() => active && toast.error(t("pages.adminFeedback.loadFailed")))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [filter]);

  const sendReply = async (row: FeedbackRow) => {
    const text = draft.trim();
    if (text.length < 2 || sending) return;
    setSending(true);
    try {
      const res = await replyToAdminFeedback(row.id, text);
      setItems((list) =>
        list.map((x) =>
          x.id === row.id
            ? { ...x, reply: text, repliedAt: new Date().toISOString(), status: res.status }
            : x,
        ),
      );
      setReplyTo(null);
      setDraft("");
      toast.success(
        res.notified
          ? t("pages.adminFeedback.replySent")
          : t("pages.adminFeedback.replySavedGuest"),
      );
    } catch {
      toast.error(t("pages.adminFeedback.replyFailed"));
    } finally {
      setSending(false);
    }
  };

  const setStatus = async (row: FeedbackRow, status: FeedbackStatus) => {
    const prev = row.status;
    setItems((list) => list.map((x) => (x.id === row.id ? { ...x, status } : x)));
    try {
      await updateAdminFeedbackStatus(row.id, status);
    } catch {
      setItems((list) => list.map((x) => (x.id === row.id ? { ...x, status: prev } : x)));
      toast.error(t("pages.adminFeedback.statusFailed"));
    }
  };

  return (
    <div>
      <H>{t("pages.adminFeedback.title")}</H>
      <div className="flex flex-wrap gap-[8px]" style={{ marginBottom: "16px" }}>
        {feedbackFilters.map((f) => (
          <button
            key={f.id}
            onClick={() => setFilter(f.id)}
            style={{
              height: "32px",
              padding: "0 14px",
              fontSize: "12px",
              fontWeight: 600,
              borderRadius: "var(--r-button)",
              border: "1px solid var(--border)",
              background: filter === f.id ? "var(--accent)" : "transparent",
              color: filter === f.id ? "var(--accent-foreground)" : "var(--foreground-70)",
            }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div
          style={{
            ...card,
            padding: "32px 16px",
            textAlign: "center",
            color: "var(--foreground-50)",
            fontSize: "13px",
          }}
        >
          {t("pages.adminCommon.loading")}
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            ...card,
            padding: "32px 16px",
            textAlign: "center",
            color: "var(--foreground-50)",
            fontSize: "13px",
          }}
        >
          <Inbox size={32} style={{ color: "var(--foreground-15)", margin: "0 auto 12px" }} />
          {t("pages.adminFeedback.empty")}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((row) => {
            const meta = feedbackStatusMeta[row.status];
            return (
              <div key={row.id} style={{ ...card, padding: "16px" }}>
                <div className="flex items-center justify-between flex-wrap gap-[8px]">
                  <div className="flex items-center gap-[8px]">
                    <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--foreground)" }}>
                      {row.subject || t("pages.adminFeedback.noSubject")}
                    </span>
                    <span
                      style={{
                        fontSize: "11px",
                        fontWeight: 600,
                        padding: "2px 8px",
                        borderRadius: "var(--r-tag)",
                        background: meta.bg,
                        color: meta.color,
                      }}
                    >
                      {meta.label}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>
                    {row.createdAt ? formatDate(row.createdAt, "absolute") : ""}
                  </span>
                </div>
                <p
                  style={{
                    marginTop: "8px",
                    fontSize: "13px",
                    color: "var(--foreground-80)",
                    whiteSpace: "pre-wrap",
                  }}
                >
                  {row.message}
                </p>
                {row.reply && (
                  <div
                    style={{
                      marginTop: "10px",
                      padding: "10px 12px",
                      borderRadius: "var(--r-card)",
                      background: "var(--background-subtle)",
                      borderLeft: "3px solid var(--accent)",
                    }}
                  >
                    <div
                      style={{ fontSize: "11px", fontWeight: 600, color: "var(--foreground-50)" }}
                    >
                      {t("pages.adminFeedback.replyLabel")}
                      {row.repliedAt ? ` · ${formatDate(row.repliedAt, "absolute")}` : ""}
                    </div>
                    <p
                      style={{
                        marginTop: "4px",
                        fontSize: "13px",
                        color: "var(--foreground-80)",
                        whiteSpace: "pre-wrap",
                      }}
                    >
                      {row.reply}
                    </p>
                  </div>
                )}
                {replyTo === row.id && (
                  <div style={{ marginTop: "10px" }}>
                    <textarea
                      value={draft}
                      onChange={(e) => setDraft(e.target.value)}
                      rows={4}
                      maxLength={4000}
                      autoFocus
                      placeholder={t("pages.adminFeedback.replyPlaceholder")}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        fontSize: "13px",
                        color: "var(--foreground)",
                        background: "var(--background)",
                        border: "1px solid var(--border)",
                        borderRadius: "var(--r-card)",
                        resize: "vertical",
                      }}
                    />
                    {row.fromGuest && (
                      <p style={{ marginTop: "6px", fontSize: "12px", color: "var(--warning)" }}>
                        {t("pages.adminFeedback.replyGuestHint")}
                      </p>
                    )}
                    <div className="flex gap-[8px]" style={{ marginTop: "8px" }}>
                      <button
                        onClick={() => void sendReply(row)}
                        disabled={draft.trim().length < 2 || sending}
                        style={{
                          ...feedbackBtn("var(--accent)", "var(--accent-foreground)"),
                          opacity: draft.trim().length < 2 || sending ? 0.5 : 1,
                        }}
                      >
                        {t("pages.adminFeedback.replySend")}
                      </button>
                      <button
                        onClick={() => {
                          setReplyTo(null);
                          setDraft("");
                        }}
                        style={feedbackBtn("transparent", "var(--foreground-70)")}
                      >
                        {t("pages.adminFeedback.replyCancel")}
                      </button>
                    </div>
                  </div>
                )}
                <div
                  className="flex items-center justify-between flex-wrap gap-[8px]"
                  style={{ marginTop: "10px" }}
                >
                  <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>
                    {row.author}
                    {row.page ? ` · ${row.page}` : ""}
                  </span>
                  <div className="flex gap-[8px]">
                    {replyTo !== row.id && (
                      <button
                        onClick={() => {
                          setReplyTo(row.id);
                          setDraft(row.reply || "");
                        }}
                        style={feedbackBtn("var(--accent)", "var(--accent-foreground)")}
                      >
                        {row.reply
                          ? t("pages.adminFeedback.replyEdit")
                          : t("pages.adminFeedback.replyOpen")}
                      </button>
                    )}
                    {row.status !== "read" && (
                      <button
                        onClick={() => setStatus(row, "read")}
                        style={feedbackBtn("transparent", "var(--foreground-70)")}
                      >
                        {t("pages.adminFeedback.markRead")}
                      </button>
                    )}
                    {row.status !== "resolved" && (
                      <button
                        onClick={() => setStatus(row, "resolved")}
                        style={feedbackBtn("var(--success)", "#fff")}
                      >
                        {t("pages.adminFeedback.markResolved")}
                      </button>
                    )}
                    {row.status !== "new" && (
                      <button
                        onClick={() => setStatus(row, "new")}
                        style={feedbackBtn("transparent", "var(--foreground-70)")}
                      >
                        {t("pages.adminFeedback.backToNew")}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function feedbackBtn(bg: string, color: string): CSSProperties {
  return {
    height: "32px",
    padding: "0 14px",
    background: bg,
    color,
    fontWeight: 600,
    fontSize: "12px",
    borderRadius: "var(--r-button)",
    border: bg === "transparent" ? "1px solid var(--border)" : "none",
  };
}
