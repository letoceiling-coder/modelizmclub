import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { verifyEmail } from "@/lib/api/auth";
import { setCurrentUser } from "@/lib/store";
import { resetSessionCache, syncFavoritesFromServer } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/client";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>): { email?: string } => ({
    email: typeof s.email === "string" ? s.email : "",
  }),
  head: () => ({ meta: [{ title: i18n.t("pages.verifyEmail.metaTitle") }] }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { email: initialEmail } = useSearch({ from: "/verify-email" });
  const [email, setEmail] = useState(initialEmail ?? "");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user } = await verifyEmail(email.trim(), code.trim());
      resetSessionCache();
      setCurrentUser(user);
      void syncFavoritesFromServer();
      toast.success(t("pages.verifyEmail.success"));
      nav({ to: "/onboarding" });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.errors
            ? (Object.values(err.errors)[0]?.[0] ?? err.message)
            : err.message
          : t("pages.verifyEmail.failed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t("pages.verifyEmail.title")}
      subtitle={t("pages.verifyEmail.subtitle")}
      footer={
        <>
          {t("pages.verifyEmail.alreadyConfirmed")}{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            {t("pages.verifyEmail.loginLink")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-[12px]">
        <input
          required
          type="email"
          placeholder={t("auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <input
          required
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder={t("pages.verifyEmail.codePlaceholder")}
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          style={inputStyle}
        />
        <button
          type="submit"
          disabled={loading}
          style={{ ...primaryBtn, marginTop: 8, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? t("pages.verifyEmail.verifying") : t("pages.verifyEmail.confirm")}
        </button>
      </form>
    </AuthShell>
  );
}
