import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import { Check, Eye, Pencil, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { formatDate } from "@/lib/format/date";
import { StatusBadge } from "@/components/StatusBadge";
import { ReviewCategoriesAdminSection } from "@/components/admin/ReviewCategoriesAdminSection";
import { ReviewsPreviewModal } from "@/components/admin/AdminReviewsPreviewModal";
import {
  fetchAdminVideos,
  updateAdminVideo,
  deleteAdminVideo,
  bulkUpdateAdminVideoStatus,
  bulkDeleteAdminVideos,
  bulkApproveAdminVideos,
  approveModeration,
  type AdminVideoRow,
} from "@/lib/api/admin";
import {
  H,
  card,
  inputStyle,
  primaryBtn,
  IconBtn,
  statusMeta,
  type BadgeVariant,
} from "@/components/admin/adminShared";
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

export function ReviewsSection({
  initialSubTab = "list",
}: {
  initialSubTab?: "list" | "categories";
}) {
  const { t } = useTranslation();
  const [subTab, setSubTab] = useState<"list" | "categories">(initialSubTab);
  const statusMetaMap = useMemo(
    () => ({
      published: {
        label: t("pages.adminReviews.statusPublishedBadge"),
        variant: "success" as BadgeVariant,
      },
      processing: {
        label: t("pages.adminReviews.statusProcessingBadge"),
        variant: "warning" as BadgeVariant,
      },
      rejected: {
        label: t("pages.adminReviews.statusRejectedBadge"),
        variant: "danger" as BadgeVariant,
      },
      scheduled: {
        label: t("pages.adminReviews.statusScheduledBadge"),
        variant: "info" as BadgeVariant,
      },
    }),
    [t],
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<AdminVideoRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<AdminVideoRow | null>(null);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  const load = useCallback(() => {
    setLoading(true);
    fetchAdminVideos({
      status: status === "all" ? undefined : status,
      q: query.trim() || undefined,
    })
      .then(setRows)
      .catch(() => toast.error(t("pages.adminReviews.loadFailed")))
      .finally(() => setLoading(false));
  }, [status, query, t]);

  useEffect(() => {
    load();
  }, [status]);

  useEffect(() => {
    setSelected(new Set());
  }, [status, query]);

  const allSelected = rows.length > 0 && rows.every((r) => selected.has(r.uuid));
  const someSelected = rows.some((r) => selected.has(r.uuid));

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someSelected && !allSelected;
    }
  }, [someSelected, allSelected]);

  const toggleOne = (uuid: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(uuid)) next.delete(uuid);
      else next.add(uuid);
      return next;
    });
  };

  const toggleAll = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allSelected) rows.forEach((r) => next.delete(r.uuid));
      else rows.forEach((r) => next.add(r.uuid));
      return next;
    });
  };

  const bulkBtnStyle: CSSProperties = {
    ...inputStyle,
    height: "34px",
    padding: "0 12px",
    fontSize: "12px",
    fontWeight: 600,
    cursor: bulkBusy ? "not-allowed" : "pointer",
    opacity: bulkBusy ? 0.6 : 1,
  };

  const bulkChangeStatus = async (next: string) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const { ok, failed } = await bulkUpdateAdminVideoStatus(ids, next);
      if (ok > 0) {
        setRows((prev) => prev.map((r) => (selected.has(r.uuid) ? { ...r, status: next } : r)));
      }
      setSelected(new Set());
      if (failed > 0) toast.error(t("pages.adminReviews.bulkPartialFail", { ok, failed }));
      else toast.success(t("pages.adminReviews.bulkStatusSuccess", { count: ok }));
    } catch {
      toast.error(t("pages.adminReviews.bulkFailed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkApprove = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const { ok, failed } = await bulkApproveAdminVideos(ids);
      setSelected(new Set());
      if (ok > 0) load();
      if (failed > 0) toast.error(t("pages.adminReviews.bulkPartialFail", { ok, failed }));
      else toast.success(t("pages.adminReviews.bulkApproveSuccess", { count: ok }));
    } catch {
      toast.error(t("pages.adminReviews.bulkFailed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkRemove = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const { ok, failed } = await bulkDeleteAdminVideos(ids);
      if (ok > 0) {
        setRows((prev) => prev.filter((r) => !selected.has(r.uuid)));
        setSelected(new Set());
      }
      setDeleteConfirmOpen(false);
      if (failed > 0) toast.error(t("pages.adminReviews.bulkPartialFail", { ok, failed }));
      else toast.success(t("pages.adminReviews.bulkDeleteSuccess", { count: ok }));
    } catch {
      toast.error(t("pages.adminReviews.bulkFailed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const tableHeaders = [
    t("pages.adminReviews.colTitle"),
    t("pages.adminReviews.colAuthor"),
    t("pages.adminReviews.colCategory"),
    t("pages.adminReviews.colDuration"),
    t("pages.adminReviews.colEngagement"),
    t("pages.adminReviews.colPublished"),
    t("pages.adminReviews.colStatus"),
    t("pages.adminReviews.colViews"),
    t("pages.adminReviews.colActions"),
  ];

  const formatDuration = (sec?: number) => {
    if (!sec || sec <= 0) return "—";
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const formatDateCell = (iso?: string) => (iso ? formatDate(iso, "date") : "—");

  const approve = async (uuid: string) => {
    try {
      await approveModeration("videos", uuid);
      toast.success(t("pages.adminReviews.approved"));
      load();
    } catch {
      toast.error(t("pages.adminReviews.approveFailed"));
    }
  };

  const changeStatus = async (uuid: string, next: string) => {
    try {
      await updateAdminVideo(uuid, { status: next });
      setRows((prev) => prev.map((r) => (r.uuid === uuid ? { ...r, status: next } : r)));
      toast.success(t("pages.adminReviews.statusUpdated"));
    } catch {
      toast.error(t("pages.adminReviews.statusUpdateFailed"));
    }
  };

  const toggleFeatured = async (uuid: string, on: boolean) => {
    setRows((prev) => prev.map((v) => (v.uuid === uuid ? { ...v, isFeatured: on } : v)));
    try {
      await updateAdminVideo(uuid, { isFeatured: on });
    } catch {
      toast.error(t("pages.adminReviews.updateFailed"));
      load();
    }
  };

  const remove = async (uuid: string) => {
    if (!window.confirm(t("pages.adminReviews.deleteConfirm"))) return;
    try {
      await deleteAdminVideo(uuid);
      setRows((prev) => prev.filter((v) => v.uuid !== uuid));
      toast.success(t("pages.adminReviews.deleted"));
    } catch {
      toast.error(t("pages.adminReviews.deleteFailed"));
      load();
    }
  };

  return (
    <div>
      <div className="flex flex-wrap gap-[8px]" style={{ marginBottom: "16px" }}>
        {(["list", "categories"] as const).map((id) => (
          <button
            key={id}
            type="button"
            onClick={() => setSubTab(id)}
            style={{
              height: "34px",
              padding: "0 14px",
              fontSize: "13px",
              fontWeight: 600,
              borderRadius: "var(--r-button)",
              border: "1px solid var(--border)",
              background: subTab === id ? "var(--accent)" : "transparent",
              color: subTab === id ? "var(--accent-foreground)" : "var(--foreground-70)",
            }}
          >
            {id === "list"
              ? t("pages.adminReviews.subTabList")
              : t("pages.adminReviews.subTabCategories")}
          </button>
        ))}
      </div>
      {subTab === "categories" ? (
        <ReviewCategoriesAdminSection />
      ) : (
        <>
          <H
            action={
              <Link to="/reviews/upload" className="text-[13px]" style={{ color: "var(--accent)" }}>
                {t("pages.adminReviews.uploadLink")}
              </Link>
            }
          >
            {t("pages.adminReviews.title")}
          </H>
          <div className="flex flex-wrap" style={{ gap: "12px" }}>
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") load();
              }}
              placeholder={t("pages.adminReviews.searchPlaceholder")}
              className="outline-none"
              style={{ ...inputStyle, width: "320px", maxWidth: "100%" }}
            />
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="outline-none"
              style={{ ...inputStyle, padding: "0 12px" }}
            >
              <option value="all">{t("pages.adminReviews.allStatuses")}</option>
              <option value="published">{t("pages.adminReviews.statusPublished")}</option>
              <option value="processing">{t("pages.adminReviews.statusProcessing")}</option>
              <option value="scheduled">{t("pages.adminReviews.statusScheduled")}</option>
              <option value="rejected">{t("pages.adminReviews.statusRejected")}</option>
            </select>
            <button type="button" onClick={load} style={{ ...inputStyle, padding: "0 14px" }}>
              {t("pages.adminReviews.refresh")}
            </button>
          </div>

          {selected.size > 0 && (
            <div
              className="flex flex-wrap items-center"
              style={{
                ...card,
                marginTop: "16px",
                padding: "12px 16px",
                gap: "10px",
                borderColor: "color-mix(in oklab, var(--accent) 35%, var(--border))",
                background: "color-mix(in oklab, var(--accent) 6%, var(--background-elevated))",
              }}
            >
              <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--foreground)" }}>
                {t("pages.adminReviews.selectedCount", { count: selected.size })}
              </span>
              <button
                type="button"
                disabled={bulkBusy}
                style={{
                  ...bulkBtnStyle,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                onClick={() => void bulkApprove()}
              >
                <Check size={13} /> {t("pages.adminReviews.bulkApprove")}
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                style={{
                  ...bulkBtnStyle,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                }}
                onClick={() => void bulkChangeStatus("published")}
              >
                <Check size={13} /> {t("pages.adminReviews.bulkPublish")}
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                style={bulkBtnStyle}
                onClick={() => void bulkChangeStatus("rejected")}
              >
                {t("pages.adminReviews.bulkReject")}
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                style={{
                  ...bulkBtnStyle,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px",
                  color: "var(--error)",
                }}
                onClick={() => setDeleteConfirmOpen(true)}
              >
                <Trash2 size={13} /> {t("pages.adminReviews.bulkDelete")}
              </button>
              <button
                type="button"
                disabled={bulkBusy}
                style={{ ...bulkBtnStyle, marginLeft: "auto", color: "var(--foreground-50)" }}
                onClick={() => setSelected(new Set())}
              >
                {t("pages.adminReviews.bulkClear")}
              </button>
            </div>
          )}

          <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
            <div style={{ overflowX: "auto" }}>
              <table className="w-full" style={{ fontSize: "13px", minWidth: "1020px" }}>
                <thead>
                  <tr style={{ background: "var(--background-surface)" }}>
                    <th style={{ padding: "10px 12px", width: "44px" }}>
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        checked={allSelected}
                        onChange={toggleAll}
                        aria-label={t("pages.adminReviews.selectAll")}
                        style={{
                          accentColor: "var(--accent)",
                          width: "16px",
                          height: "16px",
                          cursor: "pointer",
                        }}
                      />
                    </th>
                    {tableHeaders.map((h) => (
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
                  {loading ? (
                    <tr>
                      <td colSpan={10} style={{ padding: "16px", color: "var(--foreground-50)" }}>
                        {t("pages.adminReviews.loading")}
                      </td>
                    </tr>
                  ) : rows.length === 0 ? (
                    <tr>
                      <td colSpan={10} style={{ padding: "16px", color: "var(--foreground-50)" }}>
                        {t("pages.adminReviews.empty")}
                      </td>
                    </tr>
                  ) : (
                    rows.map((v) => {
                      const meta = statusMeta(statusMetaMap, v.status);
                      const isSelected = selected.has(v.uuid);
                      return (
                        <tr
                          key={v.uuid}
                          style={{
                            borderTop: "1px solid var(--border)",
                            background: isSelected
                              ? "color-mix(in oklab, var(--accent) 5%, transparent)"
                              : undefined,
                          }}
                        >
                          <td style={{ padding: "10px 12px" }}>
                            <input
                              type="checkbox"
                              checked={isSelected}
                              onChange={() => toggleOne(v.uuid)}
                              aria-label={t("pages.adminReviews.selectRow", { title: v.title })}
                              style={{
                                accentColor: "var(--accent)",
                                width: "16px",
                                height: "16px",
                                cursor: "pointer",
                              }}
                            />
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              color: "var(--foreground)",
                              fontWeight: 500,
                            }}
                          >
                            <div className="truncate max-w-[280px]">{v.title}</div>
                            {v.scheduledAt && (
                              <div
                                className="text-[11px]"
                                style={{ color: "var(--foreground-50)" }}
                              >
                                {t("pages.adminReviews.scheduledAt", {
                                  date: formatDate(v.scheduledAt, "absolute"),
                                })}
                              </div>
                            )}
                          </td>
                          <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                            {v.author}
                          </td>
                          <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                            {v.category}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              color: "var(--foreground-70)",
                              fontFamily: "var(--font-mono, monospace)",
                            }}
                          >
                            {formatDuration(v.durationSeconds)}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              color: "var(--foreground-70)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {t("pages.adminReviews.engagementSummary", {
                              likes: v.likesCount,
                              comments: v.commentsCount,
                            })}
                          </td>
                          <td
                            style={{
                              padding: "10px 16px",
                              color: "var(--foreground-70)",
                              whiteSpace: "nowrap",
                            }}
                          >
                            {formatDateCell(v.publishedAt)}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>
                          </td>
                          <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                            {v.views.toLocaleString()}
                          </td>
                          <td style={{ padding: "10px 16px" }}>
                            <div className="flex flex-wrap items-center gap-[6px]">
                              {v.status === "processing" && (
                                <IconBtn
                                  success
                                  onClick={() => approve(v.uuid)}
                                  title={t("pages.adminReviews.approve")}
                                >
                                  <Check size={14} />
                                </IconBtn>
                              )}
                              <IconBtn
                                onClick={() => setPreview(v)}
                                title={t("pages.adminReviews.preview")}
                              >
                                <Eye size={14} />
                              </IconBtn>
                              <Link
                                to="/reviews/upload"
                                search={{ edit: v.uuid }}
                                title={t("pages.adminReviews.edit")}
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "var(--r-card-sm)",
                                  border: "1px solid var(--border)",
                                  background: "transparent",
                                  color: "var(--foreground-70)",
                                  display: "grid",
                                  placeItems: "center",
                                  textDecoration: "none",
                                }}
                              >
                                <Pencil size={14} />
                              </Link>
                              <Link
                                to="/reviews/$id"
                                params={{ id: v.uuid }}
                                className="text-[12px]"
                                style={{ color: "var(--accent)" }}
                              >
                                {t("pages.adminReviews.onSite")}
                              </Link>
                              <label
                                className="flex items-center gap-[4px] text-[11px]"
                                style={{ color: "var(--foreground-70)" }}
                              >
                                <input
                                  type="checkbox"
                                  checked={v.isFeatured}
                                  onChange={(e) => toggleFeatured(v.uuid, e.target.checked)}
                                  style={{ accentColor: "var(--accent)" }}
                                />
                                {t("pages.adminReviews.promo")}
                              </label>
                              <IconBtn
                                danger
                                onClick={() => remove(v.uuid)}
                                title={t("pages.adminReviews.delete")}
                              >
                                <Trash2 size={14} />
                              </IconBtn>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
          {preview && (
            <ReviewsPreviewModal
              video={preview}
              onClose={() => setPreview(null)}
              onApprove={(uuid) => {
                void approve(uuid);
                setPreview(null);
              }}
              onChangeStatus={(uuid, next) => {
                void changeStatus(uuid, next);
                setPreview(null);
              }}
              formatDuration={formatDuration}
            />
          )}
          <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{t("pages.adminReviews.bulkDeleteConfirm")}</AlertDialogTitle>
                <AlertDialogDescription>
                  {t("pages.adminReviews.bulkDeleteDesc", { count: selected.size })}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={bulkBusy}>
                  {t("pages.adminReviews.close")}
                </AlertDialogCancel>
                <AlertDialogAction
                  disabled={bulkBusy}
                  onClick={() => void bulkRemove()}
                  style={{ background: "var(--error)" }}
                >
                  {t("pages.adminReviews.bulkDelete")}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </>
      )}
    </div>
  );
}
