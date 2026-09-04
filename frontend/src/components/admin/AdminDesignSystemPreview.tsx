import { useMemo } from "react";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Plus, Pencil, Trash2, CheckCircle2, Info, AlertCircle, Upload } from "lucide-react";
import { Panel } from "@/components/admin/adminShared";

/** Component showcase (buttons/badges/alerts/inputs/nav …) rendered live with
 *  the currently applied theme — split out of AdminDesignSystemSection to
 *  keep that file under the per-file line budget. */
export function PreviewArea() {
  const { t } = useTranslation();
  const navItems = useMemo(
    () => [
      { label: t("pages.adminDesignSystem.preview.navHome"), active: true },
      { label: t("pages.adminDesignSystem.preview.navFeed"), active: false },
      { label: t("pages.adminDesignSystem.preview.navChannels"), active: false },
      { label: t("pages.adminDesignSystem.preview.navMessages"), active: false },
    ],
    [t],
  );
  return (
    <div
      style={{
        display: "grid",
        gap: 16,
        gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))",
      }}
    >
      {/* Buttons */}
      <Panel title={t("pages.adminDesignSystem.preview.buttons")}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
          <button
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "var(--shadow-button)",
            }}
          >
            {t("pages.adminDesignSystem.preview.btnPrimary")}
          </button>
          <button
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: "var(--accent-soft)",
              color: "var(--accent)",
              fontSize: 13,
              fontWeight: 600,
            }}
          >
            {t("pages.adminDesignSystem.preview.btnSoft")}
          </button>
          <button
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: "transparent",
              color: "var(--foreground)",
              fontSize: 13,
              fontWeight: 600,
              border: "1px solid var(--border)",
            }}
          >
            {t("pages.adminDesignSystem.preview.btnOutline")}
          </button>
          <button
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: "var(--background-surface)",
              color: "var(--foreground-70)",
              fontSize: 13,
              fontWeight: 600,
            }}
            disabled
          >
            Disabled
          </button>
        </div>
        <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
          <button
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Plus size={16} />
          </button>
          <button
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "var(--accent-soft)",
              color: "var(--accent)",
              display: "grid",
              placeItems: "center",
            }}
          >
            <Pencil size={16} />
          </button>
          <button
            style={{
              width: 40,
              height: 40,
              borderRadius: 10,
              background: "var(--background-surface)",
              color: "var(--foreground-70)",
              display: "grid",
              placeItems: "center",
              border: "1px solid var(--border)",
            }}
          >
            <Trash2 size={16} />
          </button>
        </div>
      </Panel>

      {/* Badges */}
      <Panel title={t("pages.adminDesignSystem.preview.badges")}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
          <Badge bg="var(--accent)" fg="var(--accent-foreground)">
            PRO
          </Badge>
          <Badge bg="var(--accent-soft)" fg="var(--accent)">
            {t("pages.adminDesignSystem.preview.badgeNew")}
          </Badge>
          <Badge bg="var(--success-soft)" fg="var(--success)">
            {t("pages.adminDesignSystem.preview.badgeActive")}
          </Badge>
          <Badge bg="var(--warning-soft)" fg="var(--warning)">
            {t("pages.adminDesignSystem.preview.badgeReview")}
          </Badge>
          <Badge bg="var(--error-soft)" fg="var(--error)">
            {t("pages.adminDesignSystem.preview.badgeRejected")}
          </Badge>
          <Badge bg="var(--info-soft)" fg="var(--info)">
            {t("pages.adminDesignSystem.preview.badgeInfo")}
          </Badge>
        </div>
      </Panel>

      {/* Alerts */}
      <Panel title={t("pages.adminDesignSystem.preview.alerts")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <Alert
            icon={<CheckCircle2 size={16} />}
            bg="var(--success-soft)"
            fg="var(--success)"
            text={t("pages.adminDesignSystem.preview.alertSaved")}
          />
          <Alert
            icon={<Info size={16} />}
            bg="var(--info-soft)"
            fg="var(--info)"
            text={t("pages.adminDesignSystem.preview.alertHint")}
          />
          <Alert
            icon={<AlertCircle size={16} />}
            bg="var(--error-soft)"
            fg="var(--error)"
            text={t("pages.adminDesignSystem.preview.alertError")}
          />
        </div>
      </Panel>

      {/* Card */}
      <Panel title={t("pages.adminDesignSystem.preview.card")}>
        <div
          style={{
            padding: 14,
            borderRadius: 12,
            background: "var(--background-surface)",
            border: "1px solid var(--border)",
          }}
        >
          <div
            style={{ fontSize: 14, fontWeight: 700, color: "var(--foreground)", marginBottom: 4 }}
          >
            {t("pages.adminDesignSystem.preview.cardTitle")}
          </div>
          <div style={{ fontSize: 12, color: "var(--foreground-70)", marginBottom: 10 }}>
            {t("pages.adminDesignSystem.preview.cardDesc")}
          </div>
          <a style={{ fontSize: 12, fontWeight: 600, color: "var(--accent)" }}>
            {t("pages.adminDesignSystem.preview.cardMore")}
          </a>
        </div>
      </Panel>

      {/* Inputs */}
      <Panel title={t("pages.adminDesignSystem.preview.inputs")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            placeholder="Email"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--background-input)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              fontSize: 13,
            }}
          />
          <input
            placeholder={t("pages.adminDesignSystem.preview.inputFocus")}
            autoFocus
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--background-input)",
              border: "1.5px solid var(--accent)",
              color: "var(--foreground)",
              fontSize: 13,
              outline: "none",
            }}
          />
          <textarea
            placeholder={t("pages.adminDesignSystem.preview.inputMessage")}
            rows={3}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--background-input)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              fontSize: 13,
              resize: "none",
            }}
          />
        </div>
      </Panel>

      {/* Upload */}
      <Panel title={t("pages.adminDesignSystem.preview.upload")}>
        <div
          style={{
            padding: 20,
            borderRadius: 12,
            border: "2px dashed var(--border-accent)",
            background: "var(--accent-soft)",
            textAlign: "center",
          }}
        >
          <Upload size={20} style={{ color: "var(--accent)", margin: "0 auto 6px" }} />
          <div style={{ fontSize: 12, color: "var(--foreground-70)" }}>
            {t("pages.adminDesignSystem.preview.uploadHint")}{" "}
            <span style={{ color: "var(--accent)", fontWeight: 600 }}>
              {t("pages.adminDesignSystem.preview.uploadChoose")}
            </span>
          </div>
        </div>
      </Panel>

      {/* Login form */}
      <Panel title={t("pages.adminDesignSystem.preview.loginForm")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <input
            placeholder={t("pages.adminDesignSystem.preview.login")}
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--background-input)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              fontSize: 13,
            }}
          />
          <input
            placeholder={t("pages.adminDesignSystem.preview.password")}
            type="password"
            style={{
              padding: "10px 12px",
              borderRadius: 10,
              background: "var(--background-input)",
              border: "1px solid var(--border)",
              color: "var(--foreground)",
              fontSize: 13,
            }}
          />
          <button
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: "var(--accent)",
              color: "var(--accent-foreground)",
              fontSize: 13,
              fontWeight: 600,
              boxShadow: "var(--shadow-button)",
            }}
          >
            {t("pages.adminDesignSystem.preview.signIn")}
          </button>
          <button
            style={{
              padding: "10px 18px",
              borderRadius: 10,
              background: "transparent",
              color: "var(--foreground-70)",
              fontSize: 13,
              fontWeight: 500,
              border: "1px solid var(--border)",
            }}
          >
            {t("pages.adminDesignSystem.preview.signUp")}
          </button>
        </div>
      </Panel>

      {/* Nav */}
      <Panel title={t("pages.adminDesignSystem.preview.nav")}>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {navItems.map((it) => (
            <div
              key={it.label}
              style={{
                padding: "8px 12px",
                borderRadius: 8,
                fontSize: 13,
                fontWeight: it.active ? 600 : 500,
                color: it.active ? "var(--accent)" : "var(--foreground-70)",
                background: it.active ? "var(--accent-soft)" : "transparent",
              }}
            >
              {it.label}
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}

function Badge({ children, bg, fg }: { children: ReactNode; bg: string; fg: string }) {
  return (
    <span
      style={{
        padding: "4px 10px",
        borderRadius: "var(--r-pill)",
        fontSize: 11,
        fontWeight: 600,
        background: bg,
        color: fg,
      }}
    >
      {children}
    </span>
  );
}
function Alert({ icon, bg, fg, text }: { icon: ReactNode; bg: string; fg: string; text: string }) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 8,
        padding: "10px 12px",
        borderRadius: 10,
        background: bg,
        color: fg,
        fontSize: 13,
        fontWeight: 500,
      }}
    >
      {icon}
      {text}
    </div>
  );
}
