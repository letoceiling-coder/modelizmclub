import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "@/lib/toast";
import { useTranslation } from "react-i18next";
import { AuthShell, AuthLogoLink } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { Button } from "@/components/ui/button";
import { OAuthButtons, OAuthDivider } from "@/components/auth/OAuthButtons";
import { login, completeOAuthLogin } from "@/lib/api/auth";
import { setCurrentUser } from "@/lib/store";
import { resetSessionCache, syncFavoritesFromServer, ensureSession } from "@/lib/auth/session";
import { isDemoMode } from "@/lib/demo-mode";
import { readIntent } from "@/lib/gate/intent";
import { ApiError } from "@/lib/api/client";
import { GOALS, metrikaGoal } from "@/lib/analytics/metrika";

type LoginSearch = {
  redirect?: string;
  oauth_token?: string;
  oauth_error?: string;
  oauth_provider?: string;
  /** Учётка заведена этим самым входом — признак от сервера, для воронки. */
  oauth_new?: string;
};

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: i18n.t("pages.login.metaTitle") }] }),
  validateSearch: (s: Record<string, unknown>): LoginSearch => ({
    redirect: typeof s.redirect === "string" ? s.redirect : undefined,
    oauth_token: typeof s.oauth_token === "string" ? s.oauth_token : undefined,
    oauth_error: typeof s.oauth_error === "string" ? s.oauth_error : undefined,
    oauth_provider: typeof s.oauth_provider === "string" ? s.oauth_provider : undefined,
    oauth_new: typeof s.oauth_new === "string" ? s.oauth_new : undefined,
  }),
  beforeLoad: async ({ search }) => {
    const { redirectIfAuthenticated } = await import("@/lib/auth/requireAuth");
    await redirectIfAuthenticated(search.redirect);
  },
  component: LoginPage,
});

/*
 * Куда вести после входа, если адрес возврата не передан.
 *
 * Гость, нажавший закрытое действие, уходит на вход через OAuth или по
 * ссылке и возвращается без `redirect` — раньше в ленту. Если уровня после
 * входа хватает, хост гейта потом сам возвращал на место; если нет (гость
 * жал «Вступить», а вошёл подтвердившим номер без подписки) — не возвращал
 * никто, и человек терял страницу, с которой начал (приёмка 13.09, D3).
 * Намерение знает эту страницу — берём адрес у него.
 */
function afterLoginTarget(redirectTo: string | undefined): string {
  if (redirectTo?.startsWith("/")) return redirectTo;
  const back = readIntent()?.returnTo;
  if (back?.startsWith("/") && !back.startsWith("/login") && !back.startsWith("/register"))
    return back;
  return "/feed";
}

function LoginPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { redirect: redirectTo, oauth_token, oauth_error, oauth_new } = Route.useSearch();
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  useEffect(() => {
    if (oauth_token || oauth_error || isDemoMode()) {
      setCheckingSession(false);
      return;
    }
    let alive = true;
    void ensureSession()
      .then((ok) => {
        if (!alive) return;
        if (ok) {
          nav({ to: afterLoginTarget(redirectTo) as "/feed", replace: true });
          return;
        }
        setCheckingSession(false);
      })
      .catch(() => {
        if (alive) setCheckingSession(false);
      });
    return () => {
      alive = false;
    };
  }, [nav, redirectTo, oauth_token, oauth_error]);

  useEffect(() => {
    if (oauth_error) {
      toast.error(
        oauth_error === "auth_failed" ? "OAuth: не удалось войти" : `OAuth: ${oauth_error}`,
      );
      nav({ to: "/login", search: { redirect: redirectTo }, replace: true });
      return;
    }
    if (!oauth_token) return;
    let alive = true;
    setLoading(true);
    void completeOAuthLogin(oauth_token)
      .then((user) => {
        if (!alive) return;
        resetSessionCache();
        setCurrentUser(user);
        /*
         * Регистрация через провайдера — тоже регистрация.
         *
         * Цель стоит ещё в `verifyEmail`, то есть на пути «почта + код». Вход
         * через VK, Яндекс или MAX заводит учётку и возвращается токеном,
         * неотличимым от входа существующего, — без признака `oauth_new` от
         * сервера доля этих регистраций молча выпадала бы из воронки.
         */
        if (oauth_new === "1") metrikaGoal(GOALS.signup);
        void syncFavoritesFromServer();
        toast.success(t("authPages.loginSuccess"));
        nav({ to: afterLoginTarget(redirectTo) as "/feed", replace: true });
      })
      .catch(() => {
        if (!alive) return;
        toast.error("OAuth: не удалось завершить вход");
        nav({ to: "/login", search: { redirect: redirectTo }, replace: true });
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [oauth_token, oauth_error, oauth_new, nav, redirectTo, t]);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldError(false);
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(form.get("password") ?? "");
    const remember = form.get("remember") === "on";
    setLoading(true);
    try {
      const user = await login(email, password, remember);
      resetSessionCache();
      setCurrentUser(user);
      void syncFavoritesFromServer();
      toast.success(t("authPages.loginSuccess"));
      nav({ to: afterLoginTarget(redirectTo) as "/feed", replace: true });
    } catch (err) {
      setFieldError(true);
      const msg =
        err instanceof ApiError
          ? err.errors
            ? (Object.values(err.errors)[0]?.[0] ?? err.message)
            : err.message
          : t("authPages.loginFailed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const leftContent = (
    <>
      <AuthLogoLink size={40} />
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
        <p
          style={{
            color: "rgba(255,255,255,0.75)",
            marginTop: 16,
            maxWidth: 420,
            fontSize: "var(--fs-body-lg)",
          }}
        >
          {t("authPages.loginSubtitle")}
        </p>
      </div>
      <div
        style={{
          fontFamily: "var(--font-mono)",
          fontSize: "var(--fs-xs)",
          color: "rgba(255,255,255,0.4)",
        }}
      >
        {t("authPages.loginQuote")}
      </div>
    </>
  );

  if (checkingSession) return null;

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
        <Input
          required
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("auth.email")}
          error={fieldError}
        />
        <PasswordInput
          required
          name="password"
          autoComplete="current-password"
          placeholder={t("auth.password")}
          error={fieldError}
        />
        <div className="flex items-center justify-between" style={{ fontSize: "var(--fs-xs)" }}>
          <label className="flex items-center gap-[8px]" style={{ color: "var(--foreground-70)" }}>
            <input
              type="checkbox"
              name="remember"
              defaultChecked
              style={{ accentColor: "var(--accent)" }}
            />
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
      <OAuthDivider />
      <OAuthButtons redirect={redirectTo} />
      {isDemoMode() && (
        <Link
          to="/feed"
          className="mt-[16px] block text-center"
          style={{ fontSize: "var(--fs-xs)", color: "var(--foreground-50)" }}
        >
          Посмотреть прототип без входа →
        </Link>
      )}
    </AuthShell>
  );
}
