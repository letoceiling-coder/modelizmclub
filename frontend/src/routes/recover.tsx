import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { forgotPassword } from "@/lib/api/auth";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/recover")({
  head: () => ({ meta: [{ title: i18n.t("pages.recover.metaTitle") }] }),
  component: RecoverPage,
});

function RecoverPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    setLoading(true);
    try {
      await forgotPassword(email);
    } catch {
      // Don't reveal whether the email exists — always show the same result.
    } finally {
      setLoading(false);
      setSent(true);
      toast.success(t("pages.recover.emailSent"));
    }
  };

  return (
    <AuthShell
      title={t("pages.recover.title")}
      subtitle={t("pages.recover.subtitle")}
      footer={
        <>
          {t("pages.recover.rememberPassword")}{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            {t("pages.recover.backToLogin")}
          </Link>
        </>
      }
    >
      {sent ? (
        <div
          style={{
            background: "var(--success-soft)",
            border: "1px solid var(--success)",
            color: "var(--foreground)",
            padding: 16,
            borderRadius: "var(--r-card-sm)",
            fontSize: "var(--fs-sm)",
          }}
        >
          {t("pages.recover.sentMessage")}
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-[12px]">
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t("pages.recover.emailPlaceholder")}
            style={inputStyle}
          />
          <button
            type="submit"
            disabled={loading}
            style={{ ...primaryBtn, marginTop: 8, opacity: loading ? 0.7 : 1 }}
          >
            {loading ? t("pages.recover.sending") : t("pages.recover.sendLink")}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
