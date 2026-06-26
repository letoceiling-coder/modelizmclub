import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { useAuth } from "@/components/auth/AuthProvider";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: tStatic("auth.loginMetaTitle") }] }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { login } = useAuth();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await login(email.trim(), password);
      toast.success(t("auth.loginSuccess"));
      nav({ to: "/feed" });
    } catch (err) {
      const msg =
        err instanceof ApiError && err.status === 422
          ? t("auth.loginInvalid")
          : err instanceof Error
            ? err.message
            : t("auth.loginInvalid");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t("nav.login")}
      subtitle={t("auth.loginSubtitle")}
      footer={
        <>
          {t("auth.noAccount")}{" "}
          <Link to="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>{t("auth.registerLink")}</Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-[12px]">
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t("auth.emailOrPhone")}
          style={inputStyle}
        />
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("auth.password")}
          style={inputStyle}
        />
        <div className="flex items-center justify-between" style={{ fontSize: "var(--fs-xs)" }}>
          <label className="flex items-center gap-[8px]" style={{ color: "var(--foreground-70)" }}>
            <input type="checkbox" defaultChecked style={{ accentColor: "var(--accent)" }} />{t("auth.rememberMe")}</label>
          <Link to="/recover" style={{ color: "var(--accent)", fontWeight: 600 }}>{t("auth.forgotPassword")}</Link>
        </div>
        <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1, marginTop: 8 }}>
          {loading ? t("auth.submittingLogin") : t("auth.submitLogin")}
        </button>
      </form>
      <Link
        to="/feed"
        className="mt-[16px] block text-center"
        style={{ fontSize: "var(--fs-xs)", color: "var(--foreground-50)" }}
      >{t("auth.demoLink")}</Link>
    </AuthShell>
  );
}
