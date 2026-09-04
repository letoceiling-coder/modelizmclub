import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { Eye, Check, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { StatusBadge } from "@/components/StatusBadge";
import {
  fetchAdminListings,
  updateAdminListingStatus,
  deleteAdminListing,
  bulkUpdateAdminListingStatus,
  bulkDeleteAdminListings,
  type AdminListingRow,
} from "@/lib/api/admin";
import {
  H,
  card,
  inputStyle,
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

export function AdsSection() {
  const { t } = useTranslation();
  const listingStatusMeta = useMemo(
    () => ({
      published: {
        label: t("pages.adminCommon.statusPublished"),
        variant: "published" as BadgeVariant,
      },
      pending_moderation: {
        label: t("pages.adminCommon.statusPendingModeration"),
        variant: "moderation" as BadgeVariant,
      },
      awaiting_payment: {
        label: t("pages.adminCommon.statusAwaitingPayment"),
        variant: "moderation" as BadgeVariant,
      },
      revision: {
        label: t("pages.adminCommon.statusRevision"),
        variant: "moderation" as BadgeVariant,
      },
      rejected: {
        label: t("pages.adminCommon.statusRejected"),
        variant: "rejected" as BadgeVariant,
      },
      draft: { label: t("pages.adminCommon.statusDraft"), variant: "default" as BadgeVariant },
      unpublished: {
        label: t("pages.adminCommon.statusUnpublished"),
        variant: "default" as BadgeVariant,
      },
      sold: { label: t("pages.adminCommon.statusSold"), variant: "default" as BadgeVariant },
      expired: { label: t("pages.adminCommon.statusExpired"), variant: "default" as BadgeVariant },
    }),
    [t],
  );
  const navigate = useNavigate();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<AdminListingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Set<string>>(() => new Set());
  const [bulkBusy, setBulkBusy] = useState(false);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const selectAllRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    setLoading(true);
    fetchAdminListings(status === "all" ? {} : { status })
      .then(setRows)
      .catch(() => toast.error(t("pages.adminAds.loadFailed")))
      .finally(() => setLoading(false));
  }, [status, t]);

  const filtered = useMemo(
    () => rows.filter((a) => !query || a.title.toLowerCase().includes(query.toLowerCase())),
    [rows, query],
  );

  useEffect(() => {
    setSelected(new Set());
  }, [status, query]);

  const allSelected = filtered.length > 0 && filtered.every((r) => selected.has(r.uuid));
  const someSelected = filtered.some((r) => selected.has(r.uuid));

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
      if (allSelected) filtered.forEach((r) => next.delete(r.uuid));
      else filtered.forEach((r) => next.add(r.uuid));
      return next;
    });
  };

  const changeStatus = async (uuid: string, next: string) => {
    try {
      await updateAdminListingStatus(uuid, next);
      setRows((prev) => prev.map((r) => (r.uuid === uuid ? { ...r, status: next } : r)));
      toast.success(t("pages.adminCommon.statusUpdated"));
    } catch {
      toast.error(t("pages.adminCommon.statusUpdateFailed"));
    }
  };

  const remove = async (uuid: string) => {
    if (!window.confirm(t("pages.adminAds.deleteConfirm"))) return;
    try {
      await deleteAdminListing(uuid);
      setRows((prev) => prev.filter((r) => r.uuid !== uuid));
      setSelected((prev) => {
        if (!prev.has(uuid)) return prev;
        const next = new Set(prev);
        next.delete(uuid);
        return next;
      });
      toast.success(t("pages.adminCommon.deleted"));
    } catch {
      toast.error(t("pages.adminCommon.deleteFailed"));
    }
  };

  const bulkChangeStatus = async (next: string) => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const { ok, failed } = await bulkUpdateAdminListingStatus(ids, next);
      if (ok > 0) {
        setRows((prev) => prev.map((r) => (selected.has(r.uuid) ? { ...r, status: next } : r)));
      }
      setSelected(new Set());
      if (failed > 0) toast.error(t("pages.adminCommon.bulkPartialFail", { ok, failed }));
      else toast.success(t("pages.adminAds.bulkStatusSuccess", { count: ok }));
    } catch {
      toast.error(t("pages.adminCommon.bulkFailed"));
    } finally {
      setBulkBusy(false);
    }
  };

  const bulkRemove = async () => {
    const ids = [...selected];
    if (!ids.length) return;
    setBulkBusy(true);
    try {
      const { ok, failed } = await bulkDeleteAdminListings(ids);
      if (ok > 0) {
        setRows((prev) => prev.filter((r) => !selected.has(r.uuid)));
        setSelected(new Set());
      }
      setDeleteConfirmOpen(false);
      if (failed > 0) toast.error(t("pages.adminCommon.bulkPartialFail", { ok, failed }));
      else toast.success(t("pages.adminAds.bulkDeleteSuccess", { count: ok }));
    } catch {
      toast.error(t("pages.adminCommon.deleteFailed"));
    } finally {
      setBulkBusy(false);
    }
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

  const tableHeaders = [
    t("pages.adminCommon.colTitle"),
    t("pages.adminCommon.colSeller"),
    t("pages.adminCommon.colPrice"),
    t("pages.adminCommon.colCategory"),
    t("pages.adminCommon.colStatus"),
    t("pages.adminCommon.colActions"),
  ];

  return (
    <div>
      <H>{t("pages.adminAds.title")}</H>
      <div className="flex flex-wrap" style={{ gap: "12px" }}>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("pages.adminCommon.searchPlaceholder")}
          className="outline-none"
          style={{ ...inputStyle, width: "320px", maxWidth: "100%" }}
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="outline-none"
          style={{ ...inputStyle, padding: "0 12px" }}
        >
          <option value="all">{t("pages.adminCommon.allStatuses")}</option>
          <option value="published">{t("pages.adminCommon.statusPublished")}</option>
          <option value="pending_moderation">
            {t("pages.adminCommon.statusPendingModeration")}
          </option>
          <option value="rejected">{t("pages.adminCommon.statusRejected")}</option>
          <option value="unpublished">{t("pages.adminCommon.statusUnpublished")}</option>
          <option value="sold">{t("pages.adminCommon.statusSold")}</option>
        </select>
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
            {t("pages.adminCommon.selectedCount", { count: selected.size })}
          </span>
          <button
            type="button"
            disabled={bulkBusy}
            style={{ ...bulkBtnStyle, display: "inline-flex", alignItems: "center", gap: "4px" }}
            onClick={() => void bulkChangeStatus("published")}
          >
            <Check size={13} /> {t("pages.adminCommon.actionPublish")}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            style={bulkBtnStyle}
            onClick={() => void bulkChangeStatus("unpublished")}
          >
            {t("pages.adminAds.bulkUnpublish")}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            style={bulkBtnStyle}
            onClick={() => void bulkChangeStatus("pending_moderation")}
          >
            {t("pages.adminAds.bulkToModeration")}
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
              borderColor: "color-mix(in oklab, var(--error) 40%, var(--border))",
            }}
            onClick={() => setDeleteConfirmOpen(true)}
          >
            <Trash2 size={13} /> {t("pages.adminCommon.bulkDelete")}
          </button>
          <button
            type="button"
            disabled={bulkBusy}
            style={{ ...bulkBtnStyle, marginLeft: "auto", color: "var(--foreground-50)" }}
            onClick={() => setSelected(new Set())}
          >
            {t("pages.adminCommon.bulkClear")}
          </button>
        </div>
      )}

      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "760px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
                <th style={{ padding: "10px 12px", width: "44px" }}>
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allSelected}
                    onChange={toggleAll}
                    aria-label={t("pages.adminAds.selectAll")}
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
                  <td colSpan={7} style={{ padding: "16px", color: "var(--foreground-50)" }}>
                    {t("pages.adminCommon.loading")}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ padding: "16px", color: "var(--foreground-50)" }}>
                    {t("pages.adminAds.empty")}
                  </td>
                </tr>
              ) : (
                filtered.map((a) => {
                  const meta = statusMeta(listingStatusMeta, a.status);
                  const isSelected = selected.has(a.uuid);
                  return (
                    <tr
                      key={a.uuid}
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
                          onChange={() => toggleOne(a.uuid)}
                          aria-label={t("pages.adminAds.selectRow", { title: a.title })}
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
                        {a.title}
                      </td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                        {a.author}
                      </td>
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "var(--foreground)",
                          fontWeight: 600,
                        }}
                      >
                        {a.price.toLocaleString("ru")} ₽
                      </td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                        {a.category}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div className="flex gap-[6px]">
                          <IconBtn
                            success
                            onClick={() => changeStatus(a.uuid, "published")}
                            title={t("pages.adminCommon.actionPublish")}
                          >
                            <Check size={14} />
                          </IconBtn>
                          <IconBtn
                            onClick={() =>
                              navigate({ to: "/admin/listings/$uuid", params: { uuid: a.uuid } })
                            }
                            title={t("pages.adminCommon.actionViewEdit")}
                          >
                            <Eye size={14} />
                          </IconBtn>
                          <IconBtn
                            danger
                            onClick={() => remove(a.uuid)}
                            title={t("pages.adminCommon.actionDelete")}
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

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("pages.adminAds.bulkDeleteConfirm")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("pages.adminAds.bulkDeleteDesc", { count: selected.size })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={bulkBusy}>
              {t("pages.adminCommon.cancel")}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={bulkBusy}
              onClick={(e) => {
                e.preventDefault();
                void bulkRemove();
              }}
              className="bg-[var(--error)] text-white hover:bg-[var(--error)]/90"
            >
              {bulkBusy ? t("pages.adminCommon.bulkDeleting") : t("pages.adminCommon.bulkDelete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
