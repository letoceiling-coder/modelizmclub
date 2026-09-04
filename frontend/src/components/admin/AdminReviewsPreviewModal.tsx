import { useTranslation } from "react-i18next";
import { Link } from "@tanstack/react-router";
import type { AdminVideoRow } from "@/lib/api/admin";
import { card, inputStyle, primaryBtn } from "@/components/admin/adminShared";

/** Full-screen preview dialog for a single review video — opened from the
 *  reviews table's "preview" action. Split out of AdminReviewsSection to keep
 *  that file under the per-file line budget. */
export function ReviewsPreviewModal({
  video,
  onClose,
  onApprove,
  onChangeStatus,
  formatDuration,
}: {
  video: AdminVideoRow;
  onClose: () => void;
  onApprove: (uuid: string) => void;
  onChangeStatus: (uuid: string, next: string) => void;
  formatDuration: (sec?: number) => string;
}) {
  const { t } = useTranslation();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("pages.adminReviews.previewDialog")}
      onClick={onClose}
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
              {video.title}
            </h3>
            <p style={{ marginTop: "6px", fontSize: "13px", color: "var(--foreground-50)" }}>
              {video.author} · {video.category}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            style={{ ...inputStyle, height: "32px", padding: "0 12px" }}
          >
            {t("pages.adminReviews.close")}
          </button>
        </div>
        {video.videoUrl ? (
          <video
            src={video.videoUrl}
            controls
            preload="metadata"
            playsInline
            poster={video.posterUrl}
            style={{
              marginTop: "16px",
              width: "100%",
              maxHeight: 420,
              borderRadius: 10,
              background: "#000",
            }}
          />
        ) : video.posterUrl ? (
          <img
            src={video.posterUrl}
            width={1200}
            height={675}
            loading="lazy"
            decoding="async"
            alt={video.title}
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
            {t("pages.adminReviews.videoUnavailable")}
          </p>
        )}
        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            borderRadius: 10,
            background: "var(--background-surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{
              fontSize: "12px",
              fontWeight: 600,
              color: "var(--foreground-70)",
              marginBottom: "8px",
            }}
          >
            {t("pages.adminReviews.mediaCheckTitle")}
          </div>
          <div className="flex flex-wrap gap-[8px] text-[12px]">
            <span style={{ color: video.videoUrl ? "var(--success)" : "var(--error)" }}>
              {video.videoUrl
                ? t("pages.adminReviews.mediaVideoOk")
                : t("pages.adminReviews.mediaVideoMissing")}
            </span>
            <span style={{ color: video.posterUrl ? "var(--success)" : "var(--warning)" }}>
              {video.posterUrl
                ? t("pages.adminReviews.mediaPosterOk")
                : t("pages.adminReviews.mediaPosterMissing")}
            </span>
            <span style={{ color: "var(--foreground-50)" }}>
              {t("pages.adminReviews.previewStats", {
                views: video.views.toLocaleString(),
                duration: formatDuration(video.durationSeconds),
                likes: video.likesCount,
                comments: video.commentsCount,
              })}
            </span>
          </div>
        </div>
        <div className="flex flex-wrap gap-[8px]" style={{ marginTop: "20px" }}>
          {video.status === "processing" && (
            <button type="button" style={primaryBtn} onClick={() => onApprove(video.uuid)}>
              {t("pages.adminReviews.approveAndPublish")}
            </button>
          )}
          {video.status !== "published" && video.status !== "processing" && (
            <button
              type="button"
              style={primaryBtn}
              onClick={() => onChangeStatus(video.uuid, "published")}
            >
              {t("pages.adminReviews.publish")}
            </button>
          )}
          {video.status === "published" && (
            <button
              type="button"
              style={inputStyle}
              onClick={() => onChangeStatus(video.uuid, "rejected")}
            >
              {t("pages.adminReviews.hideReview")}
            </button>
          )}
          <Link
            to="/reviews/upload"
            search={{ edit: video.uuid }}
            className="inline-flex items-center"
            style={{
              ...inputStyle,
              height: "36px",
              padding: "0 14px",
              textDecoration: "none",
              color: "var(--foreground)",
            }}
          >
            {t("pages.adminReviews.edit")}
          </Link>
        </div>
      </div>
    </div>
  );
}
