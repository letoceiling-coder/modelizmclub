import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { login } from "@/lib/api/auth";
import { setCurrentUser } from "@/lib/store";
import { resetSessionCache } from "@/lib/auth/session";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Вход — МоДелизМ" }] }),
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
  }),
  component: LoginPage,
});

function LoginPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { redirect: redirectTo } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldError(false);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const remember = form.get("remember") === "on";
    setLoading(true);
    try {
      const user = await login(email, password, remember);
      resetSessionCache();
      setCurrentUser(user);
      toast.success(t("authPages.loginSuccess"));
      const target = redirectTo?.startsWith("/") ? redirectTo : "/feed";
      nav({ to: target as "/feed" });
    } catch (err) {
      setFieldError(true);
      const msg =
        err instanceof ApiError
          ? err.status === 401 || err.status === 422
            ? t("authPages.loginInvalid")
            : err.message
          : t("authPages.loginFailed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const leftContent = (
    <>
      <Logo size={40} />
      <div>
        <h2
          style={{
            fontFamily: "var(--font-display)",
            fontSize: 44,
            fontWeight: 800,
            letterSpacing: "-0.02em",
            lineHeight: 1.15,
            maxWidth: 460,
          }}
        >
          {t("authPages.loginTitle")}
        </h2>
        <p style={{ color: "rgba(255,255,255,0.75)", marginTop: 16, maxWidth: 420, fontSize: "var(--fs-body-lg)" }}>
          {t("authPages.loginSubtitle")}
        </p>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "rgba(255,255,255,0.4)" }}>
        {t("authPages.loginQuote")}
      </div>
    </>
  );

  return (
    <AuthShell
      title={t("auth.login")}
      subtitle={t("authPages.loginTitle")}
      leftContent={leftContent}
      footer={
        <>
          {t("authPages.noAccount")}{" "}
          <Link to="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>
            {t("authPages.registerLink")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-[12px]" autoComplete="on">
        <Input required name="email" type="email" autoComplete="email" placeholder={t("auth.email")} error={fieldError} />
        <Input required name="password" type="password" autoComplete="current-password" placeholder={t("auth.password")} error={fieldError} />
        <div className="flex items-center justify-between" style={{ fontSize: "var(--fs-xs)" }}>
          <label className="flex items-center gap-[8px]" style={{ color: "var(--foreground-70)" }}>
            <input type="checkbox" name="remember" defaultChecked style={{ accentColor: "var(--accent)" }} />
            {t("authPages.rememberMe")}
          </label>
          <Link to="/recover" style={{ color: "var(--accent)", fontWeight: 600 }}>
            {t("auth.forgot")}
          </Link>
        </div>
        <Button type="submit" disabled={loading} className="w-full" style={{ marginTop: 8 }}>
          {loading ? t("common.loading") : t("auth.login")}
        </Button>
      </form>
      <Link
        to="/feed"
        className="mt-[16px] block text-center"
        style={{ fontSize: "var(--fs-xs)", color: "var(--foreground-50)" }}
      >
        Посмотреть прототип без входа →
      </Link>
    </AuthShell>
  );
}
