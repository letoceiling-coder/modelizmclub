import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { forgotPasswordWithApi } from "@/lib/api/auth-api";

export const Route = createFileRoute("/recover")({
  head: () => ({ meta: [{ title: tStatic("auth.recoverMetaTitle") }] }),
  component: RecoverPage,
});

function RecoverPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPasswordWithApi(email.trim());
      setSent(true);
      toast.success(t("auth.emailSent"));
    } catch {
      // Avoid leaking which emails exist: still show success state.
      setSent(true);
      toast.success(t("auth.emailSent"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t("auth.recoverTitle")}
      subtitle={t("auth.recoverSubtitle")}
      footer={
        <>
          {t("auth.remembered")}{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>{t("auth.backToLogin")}</Link>
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
        >{t("auth.emailSentNote")}</div>
      ) : (
        <form onSubmit={(e) => void submit(e)} className="space-y-[12px]">
          <input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("auth.emailPlaceholder")} style={inputStyle} />
          <button type="submit" disabled={loading} style={{ ...primaryBtn, marginTop: 8, opacity: loading ? 0.6 : 1 }}>{t("auth.sendLink")}</button>
        </form>
      )}
    </AuthShell>
  );
}
