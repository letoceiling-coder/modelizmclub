import { useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, Check, Trash2 } from "lucide-react";
import { toast } from "@/lib/toast";
import { StatusBadge } from "@/components/StatusBadge";
import {
  fetchAdminPosts,
  updateAdminPostStatus,
  deleteAdminPost,
  type AdminPostRow,
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

export function ContentSection() {
  const { t } = useTranslation();
  const postStatusMeta = useMemo(
    () => ({
      published: {
        label: t("pages.adminCommon.statusPublished"),
        variant: "published" as BadgeVariant,
      },
      pending_moderation: {
        label: t("pages.adminCommon.statusPendingModeration"),
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
      hidden: { label: t("pages.adminCommon.statusHidden"), variant: "default" as BadgeVariant },
      archived: {
        label: t("pages.adminCommon.statusArchived"),
        variant: "default" as BadgeVariant,
      },
    }),
    [t],
  );
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("all");
  const [rows, setRows] = useState<AdminPostRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [preview, setPreview] = useState<AdminPostRow | null>(null);

  useEffect(() => {
    setLoading(true);
    fetchAdminPosts(status === "all" ? {} : { status })
      .then(setRows)
      .catch(() => toast.error(t("pages.adminContent.loadFailed")))
      .finally(() => setLoading(false));
  }, [status, t]);

  const filtered = rows.filter(
    (p) => !query || p.title.toLowerCase().includes(query.toLowerCase()),
  );

  const changeStatus = async (uuid: string, next: string) => {
    try {
      await updateAdminPostStatus(uuid, next);
      setRows((prev) => prev.map((r) => (r.uuid === uuid ? { ...r, status: next } : r)));
      toast.success(t("pages.adminCommon.statusUpdated"));
    } catch {
      toast.error(t("pages.adminCommon.statusUpdateFailed"));
    }
  };
  const remove = async (uuid: string) => {
    if (!window.confirm(t("pages.adminContent.deleteConfirm"))) return;
    try {
      await deleteAdminPost(uuid);
      setRows((prev) => prev.filter((r) => r.uuid !== uuid));
      toast.success(t("pages.adminCommon.deleted"));
    } catch {
      toast.error(t("pages.adminCommon.deleteFailed"));
    }
  };

  const tableHeaders = [
    t("pages.adminCommon.colTitle"),
    t("pages.adminCommon.colAuthor"),
    t("pages.adminCommon.colCategory"),
    t("pages.adminCommon.colStatus"),
    t("pages.adminCommon.colActions"),
  ];

  return (
    <div>
      <H>{t("pages.adminContent.title")}</H>
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
          <option value="hidden">{t("pages.adminCommon.statusHidden")}</option>
          <option value="draft">{t("pages.adminCommon.statusDraft")}</option>
        </select>
      </div>
      <div style={{ ...card, marginTop: "16px", overflow: "hidden" }}>
        <div style={{ overflowX: "auto" }}>
          <table className="w-full" style={{ fontSize: "13px", minWidth: "700px" }}>
            <thead>
              <tr style={{ background: "var(--background-surface)" }}>
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
                  <td colSpan={5} style={{ padding: "16px", color: "var(--foreground-50)" }}>
                    {t("pages.adminCommon.loading")}
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ padding: "16px", color: "var(--foreground-50)" }}>
                    {t("pages.adminContent.empty")}
                  </td>
                </tr>
              ) : (
                filtered.map((p) => {
                  const meta = statusMeta(postStatusMeta, p.status);
                  return (
                    <tr key={p.uuid} style={{ borderTop: "1px solid var(--border)" }}>
                      <td
                        style={{
                          padding: "10px 16px",
                          color: "var(--foreground)",
                          fontWeight: 500,
                        }}
                      >
                        {p.title}
                      </td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                        {p.author}
                      </td>
                      <td style={{ padding: "10px 16px", color: "var(--foreground-70)" }}>
                        {p.community ?? p.category}
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <StatusBadge variant={meta.variant}>{meta.label}</StatusBadge>
                      </td>
                      <td style={{ padding: "10px 16px" }}>
                        <div className="flex gap-[6px]">
                          <IconBtn
                            success
                            onClick={() => changeStatus(p.uuid, "published")}
                            title={t("pages.adminCommon.actionApprove")}
                          >
                            <Check size={14} />
                          </IconBtn>
                          <IconBtn
                            onClick={() => setPreview(p)}
                            title={t("pages.adminCommon.actionPreview")}
                          >
                            <Eye size={14} />
                          </IconBtn>
                          <IconBtn
                            danger
                            onClick={() => remove(p.uuid)}
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
      {preview && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t("pages.adminContent.previewDialog")}
          onClick={() => setPreview(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 1000,
            background: "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "24px",
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              ...card,
              width: "min(720px, 100%)",
              maxHeight: "90vh",
              overflow: "auto",
              padding: "20px",
            }}
          >
            <div className="flex items-start justify-between gap-[12px]">
              <div>
                <h3
                  style={{
                    fontFamily: "var(--font-display)",
                    fontSize: "18px",
                    fontWeight: 600,
                    color: "var(--foreground)",
                  }}
                >
                  {preview.title}
                </h3>
                <p style={{ marginTop: "6px", fontSize: "13px", color: "var(--foreground-50)" }}>
                  {preview.author} · {preview.category}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setPreview(null)}
                style={{ ...inputStyle, height: "32px", padding: "0 12px" }}
              >
                {t("pages.adminCommon.close")}
              </button>
            </div>
            {preview.body && (
              <p
                style={{
                  marginTop: "16px",
                  whiteSpace: "pre-wrap",
                  fontSize: "14px",
                  lineHeight: 1.6,
                  color: "var(--foreground-90)",
                }}
              >
                {preview.body}
              </p>
            )}
            {preview.video ? (
              <video
                src={preview.video}
                controls
                preload="metadata"
                playsInline
                style={{
                  marginTop: "16px",
                  width: "100%",
                  maxHeight: 420,
                  borderRadius: 10,
                  background: "#000",
                }}
              />
            ) : preview.images[0] ? (
              <img
                src={preview.images[0]}
                width={1200}
                height={675}
                loading="lazy"
                decoding="async"
                alt={preview.title}
                style={{
                  marginTop: "16px",
                  width: "100%",
                  maxHeight: 420,
                  objectFit: "contain",
                  borderRadius: 10,
                  background: "var(--background-surface)",
                }}
              />
            ) : (
              <p style={{ marginTop: "16px", fontSize: "13px", color: "var(--foreground-50)" }}>
                {t("pages.adminContent.noMedia")}
              </p>
            )}
            <div className="flex flex-wrap gap-[8px]" style={{ marginTop: "20px" }}>
              <button
                type="button"
                style={primaryBtn}
                onClick={() => {
                  void changeStatus(preview.uuid, "published");
                  setPreview(null);
                }}
              >
                {t("pages.adminCommon.approveAndPublish")}
              </button>
              <button
                type="button"
                style={{ ...inputStyle, height: "40px", padding: "0 16px", fontWeight: 600 }}
                onClick={() => {
                  void changeStatus(preview.uuid, "rejected");
                  setPreview(null);
                }}
              >
                {t("pages.adminCommon.reject")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
