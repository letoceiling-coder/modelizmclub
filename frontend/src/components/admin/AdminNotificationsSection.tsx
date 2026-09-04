import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Send } from "lucide-react";
import { toast } from "@/lib/toast";
import { broadcastNotification } from "@/lib/api/admin";
import { H, card, inputStyle, primaryBtn } from "@/components/admin/adminShared";

export function NotificationsSection() {
  const { t } = useTranslation();
  const [title, setTitle] = useState("");
  const [body, setBody] = useState("");
  const [link, setLink] = useState("");
  const [sending, setSending] = useState(false);

  const send = async () => {
    if (!title.trim()) return toast.error(t("pages.adminNotifications.errTitle"));
    if (!window.confirm(t("pages.adminNotifications.confirmSend"))) return;
    setSending(true);
    try {
      const sent = await broadcastNotification({
        title: title.trim(),
        body: body.trim() || undefined,
        link: link.trim() || undefined,
      });
      toast.success(t("pages.adminNotifications.sent", { count: sent }));
      setTitle("");
      setBody("");
      setLink("");
    } catch {
      toast.error(t("pages.adminNotifications.sendFailed"));
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <H>{t("pages.adminNotifications.title")}</H>
      <div style={{ ...card, padding: "20px", maxWidth: "640px" }}>
        <h4
          style={{
            fontFamily: "var(--font-display)",
            fontWeight: 600,
            fontSize: "16px",
            color: "var(--foreground)",
            marginBottom: "4px",
          }}
        >
          {t("pages.adminNotifications.broadcastTitle")}
        </h4>
        <p style={{ fontSize: "13px", color: "var(--foreground-50)", marginBottom: "16px" }}>
          {t("pages.adminNotifications.broadcastHint")}
        </p>
        <div className="space-y-[12px]">
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground-70)" }}>
              {t("pages.adminNotifications.fieldTitle")}
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={160}
              placeholder={t("pages.adminNotifications.titlePlaceholder")}
              className="outline-none"
              style={{ ...inputStyle, width: "100%", marginTop: 4 }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground-70)" }}>
              {t("pages.adminNotifications.fieldBody")}
            </label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              rows={3}
              placeholder={t("pages.adminNotifications.bodyPlaceholder")}
              className="outline-none"
              style={{
                ...inputStyle,
                width: "100%",
                height: "auto",
                padding: "10px 12px",
                marginTop: 4,
                resize: "vertical",
              }}
            />
          </div>
          <div>
            <label style={{ fontSize: "12px", fontWeight: 600, color: "var(--foreground-70)" }}>
              {t("pages.adminNotifications.fieldLink")}
            </label>
            <input
              value={link}
              onChange={(e) => setLink(e.target.value)}
              maxLength={255}
              placeholder={t("pages.adminNotifications.linkPlaceholder")}
              className="outline-none"
              style={{ ...inputStyle, width: "100%", marginTop: 4 }}
            />
          </div>
        </div>
        <button
          onClick={send}
          disabled={sending}
          className="inline-flex items-center gap-[8px]"
          style={{
            ...primaryBtn,
            height: "44px",
            padding: "0 24px",
            fontSize: "14px",
            marginTop: "16px",
            opacity: sending ? 0.7 : 1,
          }}
        >
          <Send size={15} />{" "}
          {sending ? t("pages.adminNotifications.sending") : t("pages.adminNotifications.sendAll")}
        </button>
      </div>
    </div>
  );
}
