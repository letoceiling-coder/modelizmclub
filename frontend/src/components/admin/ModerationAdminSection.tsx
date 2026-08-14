import { Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState, type CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { ExternalLink, ShieldCheck } from "lucide-react";
import { toast } from "@/lib/toast";
import { formatApiErrorMessage } from "@/lib/api/validationErrors";
import {
  approveModeration,
  fetchAdminReports,
  fetchModerationQueue,
  rejectModeration,
  reviseModeration,
  updateAdminReportStatus,
  type AdminReportRow,
  type ModerationItem,
  type ModerationType,
  type ReportStatus,
} from "@/lib/api/admin";
import { REPORT_REASON_LABELS, type ReportReason } from "@/lib/api/reports";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const card: CSSProperties = {
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card)",
};

const QUEUE_TAB_IDS = ["posts", "channel_posts", "communities", "listings", "videos"] as const;
type QueueTabId = (typeof QUEUE_TAB_IDS)[number];

const REPORT_FILTER_IDS = ["all", "pending", "reviewing", "resolved", "rejected", "dismissed"] as const;
const REPORT_STATUS_IDS: ReportStatus[] = ["pending", "reviewing", "resolved", "rejected", "dismissed"];
const REPORT_TARGET_IDS = ["user", "message", "conversation", "post", "listing", "comment", "video", "community"] as const;
const REPORT_ENTITY_TAB_IDS = ["all", "posts", "listings", "videos", "communities", "users"] as const;
type ReportEntityTabId = (typeof REPORT_ENTITY_TAB_IDS)[number];

const REPORT_ENTITY_TYPES: Record<ReportEntityTabId, string[] | null> = {
  all: null,
  posts: ["post", "comment"],
  listings: ["listing"],
  videos: ["video"],
  communities: ["community"],
  users: ["user", "message", "conversation"],
};

function moderationOpenPath(item: ModerationItem): string | null {
  switch (item.type) {
    case "posts":
      return "/feed";
    case "channel_posts":
      return item.channelSlug ? `/channel/${item.channelSlug}` : null;
    case "communities":
      return item.communitySlug ? `/communities/${item.communitySlug}` : null;
    case "listings":
      return item.targetId ? `/ads/${item.targetId}` : null;
    case "videos":
      return item.targetId ? `/reviews/${item.targetId}` : null;
    default:
      return null;
  }
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
    cursor: "pointer",
  };
}

function EmptyQueue({ label }: { label: string }) {
  return (
    <div style={{ ...card, padding: "32px 16px", textAlign: "center", color: "var(--foreground-50)", fontSize: "13px" }}>
      <ShieldCheck size={32} style={{ color: "var(--foreground-15)", margin: "0 auto 12px" }} />
      {label}
    </div>
  );
}

function ModerationDetailCard({
  item,
  typeLabel,
  onApprove,
  onReject,
  onRevision,
}: {
  item: ModerationItem;
  typeLabel: string;
  onApprove: () => void;
  onReject: () => void;
  onRevision: () => void;
}) {
  const { t } = useTranslation();
  const openPath = moderationOpenPath(item);
  const submitted = item.submittedAt ? new Date(item.submittedAt).toLocaleString("ru-RU") : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, height: 0, marginBottom: 0, overflow: "hidden" }}
      transition={{ duration: 0.25 }}
      style={{ ...card, padding: "18px" }}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div style={{ flex: 1, minWidth: 0 }}>
          <div className="flex flex-wrap items-center gap-2">
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 8px", borderRadius: "var(--r-tag)", background: "var(--accent-soft)", color: "var(--accent)" }}>
              {typeLabel}
            </span>
            {item.category && (
              <span style={{ fontSize: "11px", fontWeight: 500, padding: "2px 8px", borderRadius: "var(--r-tag)", background: "var(--background-subtle)", color: "var(--foreground-70)" }}>
                {item.category}
              </span>
            )}
          </div>
          <h5 style={{ marginTop: "10px", fontWeight: 700, fontSize: "16px", color: "var(--foreground)", lineHeight: 1.35 }}>
            {item.title}
          </h5>
          <div style={{ marginTop: "6px", fontSize: "12px", color: "var(--foreground-50)" }}>
            {t("pages.adminModeration.cardAuthor", { name: item.author || "—" })}
            {submitted ? ` · ${t("pages.adminModeration.cardSubmitted", { date: submitted })}` : ""}
            {item.priceRub != null ? ` · ${item.priceRub.toLocaleString("ru-RU")} ₽` : ""}
          </div>
        </div>
      </div>

      {item.body.trim() && (
        <div
          style={{
            marginTop: "14px",
            padding: "12px 14px",
            borderRadius: "var(--r-card-sm)",
            background: "var(--background-surface)",
            border: "1px solid var(--border)",
            fontSize: "13px",
            lineHeight: 1.55,
            color: "var(--foreground-80)",
            whiteSpace: "pre-wrap",
            maxHeight: "220px",
            overflow: "auto",
          }}
        >
          {item.body}
        </div>
      )}

      {item.media.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {item.media.map((m) =>
            m.mime_type?.startsWith("image/") ? (
              <a key={m.url} href={m.url} target="_blank" rel="noreferrer">
                <img src={m.url} alt="" style={{ width: 88, height: 88, objectFit: "cover", borderRadius: 8, border: "1px solid var(--border)" }} />
              </a>
            ) : null,
          )}
        </div>
      )}

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onApprove} style={feedbackBtn("var(--success)", "#fff")}>
          {t("pages.adminModeration.cardApprove")}
        </button>
        <button type="button" onClick={onRevision} style={feedbackBtn("var(--warning-soft)", "var(--warning)")}>
          {t("pages.adminModeration.cardRevision")}
        </button>
        <button type="button" onClick={onReject} style={feedbackBtn("var(--error)", "#fff")}>
          {t("pages.adminModeration.cardReject")}
        </button>
        {openPath ? (
          <Link to={openPath} target="_blank" style={{ ...feedbackBtn("transparent", "var(--foreground-70)"), display: "inline-flex", alignItems: "center", gap: 6, textDecoration: "none" }}>
            {t("pages.adminModeration.cardOpen")} <ExternalLink size={14} />
          </Link>
        ) : null}
      </div>
    </motion.div>
  );
}

function ReportsPanel() {
  const { t } = useTranslation();
  const reportFilters = useMemo(
    () => REPORT_FILTER_IDS.map((id) => ({ id, label: t(`pages.adminModeration.filters.${id}`) })),
    [t],
  );
  const entityTabs = useMemo(
    () => REPORT_ENTITY_TAB_IDS.map((id) => ({ id, label: t(`pages.adminModeration.entityTabs.${id}`) })),
    [t],
  );
  const reportStatusMeta = useMemo(
    () =>
      Object.fromEntries(
        REPORT_STATUS_IDS.map((id) => [
          id,
          {
            label: t(`pages.adminModeration.reportStatus.${id}`),
            bg:
              id === "pending"
                ? "var(--accent-soft)"
                : id === "reviewing"
                  ? "var(--warning-soft)"
                  : id === "resolved"
                    ? "color-mix(in oklab, var(--success) 18%, transparent)"
                    : id === "rejected"
                      ? "color-mix(in oklab, var(--error) 15%, transparent)"
                      : "var(--background-subtle)",
            color:
              id === "pending"
                ? "var(--accent)"
                : id === "reviewing"
                  ? "var(--warning)"
                  : id === "resolved"
                    ? "var(--success)"
                    : id === "rejected"
                      ? "var(--error)"
                      : "var(--foreground-50)",
          },
        ]),
      ) as Record<ReportStatus, { label: string; bg: string; color: string }>,
    [t],
  );
  const reportTargetLabels = useMemo(
    () =>
      Object.fromEntries(REPORT_TARGET_IDS.map((id) => [id, t(`pages.adminModeration.reportTargets.${id}`)])) as Record<string, string>,
    [t],
  );

  const [filter, setFilter] = useState<ReportStatus | "all">("pending");
  const [entityTab, setEntityTab] = useState<ReportEntityTabId>("all");
  const [items, setItems] = useState<AdminReportRow[]>([]);
  const [pendingCounts, setPendingCounts] = useState<Partial<Record<ReportEntityTabId, number>>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    fetchAdminReports("pending")
      .then((rows) => {
        if (!active) return;
        const counts: Partial<Record<ReportEntityTabId, number>> = { all: rows.length };
        for (const tab of REPORT_ENTITY_TAB_IDS) {
          if (tab === "all") continue;
          const types = REPORT_ENTITY_TYPES[tab] ?? [];
          counts[tab] = rows.filter((r) => types.includes(r.targetType)).length;
        }
        setPendingCounts(counts);
      })
      .catch(() => {});
    return () => { active = false; };
  }, []);

  useEffect(() => {
    let active = true;
    setLoading(true);
    const targetTypes = REPORT_ENTITY_TYPES[entityTab] ?? undefined;
    fetchAdminReports(filter === "all" ? undefined : filter, targetTypes ?? undefined)
      .then((rows) => active && setItems(rows))
      .catch(() => active && toast.error(t("pages.adminModeration.reportsLoadFailed")))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, [filter, entityTab, t]);

  const setStatus = async (row: AdminReportRow, status: ReportStatus) => {
    const prev = row.status;
    setItems((list) => list.map((x) => (x.id === row.id ? { ...x, status } : x)));
    try {
      await updateAdminReportStatus(row.id, status);
      toast.success(t("pages.adminModeration.reportStatusUpdated"));
    } catch {
      setItems((list) => list.map((x) => (x.id === row.id ? { ...x, status: prev } : x)));
      toast.error(t("pages.adminModeration.reportStatusFailed"));
    }
  };

  return (
    <div>
      <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginBottom: "14px" }}>{t("pages.adminModeration.reportsHint")}</p>
      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground-50)", marginBottom: "8px" }}>{t("pages.adminModeration.reportsEntityLabel")}</div>
      <div className="flex flex-wrap gap-[8px]" style={{ marginBottom: "12px" }}>
        {entityTabs.map((tab) => {
          const pending = pendingCounts[tab.id] ?? 0;
          return (
            <button key={tab.id} type="button" onClick={() => setEntityTab(tab.id)} style={tabBtn(entityTab === tab.id)}>
              {tab.label}
              {pending > 0 && <span style={countPill}>{pending}</span>}
            </button>
          );
        })}
      </div>
      <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground-50)", marginBottom: "8px" }}>{t("pages.adminModeration.reportsStatusLabel")}</div>
      <div className="flex flex-wrap gap-[8px]" style={{ marginBottom: "16px" }}>
        {reportFilters.map((f) => (
          <button key={f.id} type="button" onClick={() => setFilter(f.id)} style={filterBtn(filter === f.id)}>
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div style={{ ...card, padding: "32px 16px", textAlign: "center", color: "var(--foreground-50)", fontSize: "13px" }}>
          {t("pages.adminCommon.loading")}
        </div>
      ) : items.length === 0 ? (
        <EmptyQueue label={t("pages.adminModeration.noReports")} />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {items.map((row) => {
            const meta = reportStatusMeta[row.status];
            const reasonLabel = REPORT_REASON_LABELS[row.reason as ReportReason] ?? row.reason;
            const targetLabel = reportTargetLabels[row.targetType] ?? row.targetType;
            return (
              <div key={row.id} style={{ ...card, padding: "16px" }}>
                <div className="flex items-center justify-between flex-wrap gap-[8px]">
                  <div className="flex items-center gap-[8px] flex-wrap">
                    <span style={{ fontWeight: 600, fontSize: "14px", color: "var(--foreground)" }}>
                      {targetLabel}
                      {row.targetUuid && row.targetType === "user" ? (
                        <> · <Link to="/user/$id" params={{ id: row.targetUuid }} style={{ color: "var(--accent)" }}>{t("pages.adminModeration.openProfile")}</Link></>
                      ) : null}
                    </span>
                    <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "var(--r-tag)", background: meta.bg, color: meta.color }}>{meta.label}</span>
                    <span style={{ fontSize: "11px", fontWeight: 500, padding: "2px 8px", borderRadius: "var(--r-tag)", background: "var(--background-subtle)", color: "var(--foreground-70)" }}>{reasonLabel}</span>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--foreground-50)" }}>{row.createdAt ? new Date(row.createdAt).toLocaleString("ru-RU") : ""}</span>
                </div>
                {row.description && <p style={{ marginTop: "8px", fontSize: "13px", color: "var(--foreground-80)", whiteSpace: "pre-wrap" }}>{row.description}</p>}
                <div className="flex items-center justify-between flex-wrap gap-[8px]" style={{ marginTop: "10px" }}>
                  <span style={{ fontSize: "12px", color: "var(--foreground-50)" }}>
                    {t("pages.adminModeration.reportFrom", { name: row.reporterName, email: row.reporterEmail ? ` (${row.reporterEmail})` : "" })}
                  </span>
                  <div className="flex flex-wrap gap-[8px]">
                    {row.status === "pending" && (
                      <button type="button" onClick={() => void setStatus(row, "reviewing")} style={feedbackBtn("var(--warning-soft)", "var(--warning)")}>{t("pages.adminModeration.takeReview")}</button>
                    )}
                    {row.status !== "resolved" && (
                      <button type="button" onClick={() => void setStatus(row, "resolved")} style={feedbackBtn("var(--success)", "#fff")}>{t("pages.adminModeration.markResolved")}</button>
                    )}
                    {row.status !== "dismissed" && (
                      <button type="button" onClick={() => void setStatus(row, "dismissed")} style={feedbackBtn("transparent", "var(--foreground-70)")}>{t("pages.adminModeration.markDismissed")}</button>
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

function tabBtn(active: boolean): CSSProperties {
  return {
    height: "34px",
    padding: "0 12px",
    fontSize: "12px",
    fontWeight: 600,
    borderRadius: "var(--r-button)",
    border: "1px solid var(--border)",
    background: active ? "var(--accent-soft)" : "transparent",
    color: active ? "var(--accent)" : "var(--foreground-70)",
    display: "inline-flex",
    alignItems: "center",
    gap: "6px",
    cursor: "pointer",
  };
}

function filterBtn(active: boolean): CSSProperties {
  return {
    height: "32px",
    padding: "0 14px",
    fontSize: "12px",
    fontWeight: 600,
    borderRadius: "var(--r-button)",
    border: "1px solid var(--border)",
    background: active ? "var(--accent)" : "transparent",
    color: active ? "var(--accent-foreground)" : "var(--foreground-70)",
    cursor: "pointer",
  };
}

const countPill: CSSProperties = {
  fontSize: "10px",
  fontWeight: 700,
  padding: "1px 6px",
  borderRadius: "var(--r-pill)",
  background: "var(--accent)",
  color: "var(--accent-foreground)",
};

export function ModerationAdminSection() {
  const { t } = useTranslation();
  const [mainTab, setMainTab] = useState<"queue" | "reports">("queue");
  const [queueTab, setQueueTab] = useState<QueueTabId>("posts");
  const [queue, setQueue] = useState<ModerationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ item: ModerationItem; mode: "reject" | "revision" } | null>(null);
  const [reasonText, setReasonText] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const reloadQueue = () => {
    setLoading(true);
    fetchModerationQueue("pending")
      .then(setQueue)
      .catch(() => toast.error(t("pages.adminModeration.queueLoadFailed")))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reloadQueue();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const queueTabs = useMemo(
    () =>
      QUEUE_TAB_IDS.map((id) => ({
        id,
        label: t(`pages.adminModeration.queueTabs.${id}`),
        count: queue.filter((q) => q.type === id).length,
      })),
    [queue, t],
  );

  const visibleItems = queue.filter((q) => q.type === queueTab);
  const totalPending = queue.length;

  const removeItem = (id: number) => setQueue((q) => q.filter((x) => x.id !== id));

  const handleApprove = async (item: ModerationItem) => {
    try {
      await approveModeration(item.type, item.targetId);
      removeItem(item.id);
      toast.success(t("pages.adminModeration.approved"));
    } catch {
      toast.error(t("pages.adminModeration.actionFailed"));
    }
  };

  const submitDecision = async () => {
    if (!dialog) return;
    const text = reasonText.trim();
    if (text.length < 10) {
      toast.error(t("pages.adminModeration.reasonTooShort"));
      return;
    }
    setSubmitting(true);
    try {
      if (dialog.mode === "reject") {
        await rejectModeration(dialog.item.type, dialog.item.targetId, text);
        toast.success(t("pages.adminModeration.rejected"));
      } else {
        await reviseModeration(dialog.item.type, dialog.item.targetId, text);
        toast.success(t("pages.adminModeration.sentToRevision"));
      }
      removeItem(dialog.item.id);
      setDialog(null);
      setReasonText("");
    } catch (e) {
      toast.error(formatApiErrorMessage(e, t("pages.adminModeration.actionFailed")));
    } finally {
      setSubmitting(false);
    }
  };

  const typeLabel = (type: ModerationType) => t(`pages.adminModeration.queueTabs.${type}`);

  return (
    <div>
      <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: "22px", color: "var(--foreground)" }}>{t("pages.adminModeration.title")}</h2>
      <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginTop: "8px", maxWidth: 720 }}>{t("pages.adminModeration.subtitle")}</p>

      <div className="flex flex-wrap gap-2" style={{ marginTop: "20px" }}>
        <button type="button" onClick={() => setMainTab("queue")} style={filterBtn(mainTab === "queue")}>
          {t("pages.adminModeration.mainTabQueue")}
          {totalPending > 0 && <span style={{ ...countPill, marginLeft: 6 }}>{totalPending}</span>}
        </button>
        <button type="button" onClick={() => setMainTab("reports")} style={filterBtn(mainTab === "reports")}>
          {t("pages.adminModeration.mainTabReports")}
        </button>
      </div>

      {mainTab === "queue" ? (
        <div style={{ marginTop: "20px" }}>
          <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginBottom: "12px" }}>{t("pages.adminModeration.queueHint")}</p>
          <div className="flex flex-wrap gap-2" style={{ marginBottom: "16px" }}>
            {queueTabs.map((tab) => (
              <button key={tab.id} type="button" onClick={() => setQueueTab(tab.id)} style={tabBtn(queueTab === tab.id)}>
                {tab.label}
                {tab.count > 0 && <span style={countPill}>{tab.count}</span>}
              </button>
            ))}
          </div>

          {loading ? (
            <div style={{ ...card, padding: "32px 16px", textAlign: "center", color: "var(--foreground-50)", fontSize: "13px" }}>
              {t("pages.adminCommon.loading")}
            </div>
          ) : visibleItems.length === 0 ? (
            <EmptyQueue label={t(`pages.adminModeration.empty.${queueTab}`)} />
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxWidth: 920 }}>
              <AnimatePresence>
                {visibleItems.map((item) => (
                  <ModerationDetailCard
                    key={item.id}
                    item={item}
                    typeLabel={typeLabel(item.type)}
                    onApprove={() => void handleApprove(item)}
                    onReject={() => { setDialog({ item, mode: "reject" }); setReasonText(""); }}
                    onRevision={() => { setDialog({ item, mode: "revision" }); setReasonText(""); }}
                  />
                ))}
              </AnimatePresence>
            </div>
          )}
        </div>
      ) : (
        <div style={{ marginTop: "20px" }}>
          <ReportsPanel />
        </div>
      )}

      <AlertDialog open={dialog != null} onOpenChange={(open) => !open && setDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {dialog?.mode === "reject" ? t("pages.adminModeration.rejectDialogTitle") : t("pages.adminModeration.revisionDialogTitle")}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {dialog?.mode === "reject" ? t("pages.adminModeration.rejectDialogDesc") : t("pages.adminModeration.revisionDialogDesc")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <textarea
            value={reasonText}
            onChange={(e) => setReasonText(e.target.value)}
            placeholder={t("pages.adminModeration.reasonPlaceholder")}
            rows={5}
            style={{
              width: "100%",
              padding: "10px 12px",
              borderRadius: "var(--r-input)",
              border: "1.5px solid var(--border)",
              background: "var(--background)",
              fontSize: "13px",
              color: "var(--foreground)",
              resize: "vertical",
            }}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={submitting}>{t("pages.adminCommon.cancel")}</AlertDialogCancel>
            <AlertDialogAction disabled={submitting} onClick={(e) => { e.preventDefault(); void submitDecision(); }}>
              {submitting ? "…" : dialog?.mode === "reject" ? t("pages.adminModeration.confirmReject") : t("pages.adminModeration.confirmRevision")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
