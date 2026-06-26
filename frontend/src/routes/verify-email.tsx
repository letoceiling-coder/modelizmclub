import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s.email === "string" ? s.email : "",
  }),
  head: () => ({ meta: [{ title: tStatic("auth.verifyMetaTitle") }] }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { email: emailFromSearch } = useSearch({ from: "/verify-email" });
  const { verifyEmail } = useAuth();
  const [email, setEmail] = useState(emailFromSearch);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await verifyEmail(email.trim(), code.trim());
      toast.success(t("auth.verifySuccess"));
      nav({ to: "/onboarding" });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("auth.verifyFailed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t("auth.verifyTitle")}
      subtitle={t("auth.verifySubtitle")}
      footer={
        <>
          {t("auth.hasAccount")}{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>{t("index.heroLogin")}</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-[12px]">
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={inputStyle}
        />
        <input
          required
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          placeholder={t("auth.verifyCodePlaceholder")}
          style={inputStyle}
        />
        <button type="submit" disabled={loading} style={{ ...primaryBtn, marginTop: 8, opacity: loading ? 0.7 : 1 }}>
          {loading ? t("auth.verifySubmitting") : t("auth.verifySubmit")}
        </button>
      </form>
    </AuthShell>
  );
}
