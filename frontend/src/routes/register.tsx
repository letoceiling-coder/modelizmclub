import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { UserPlus, Megaphone, Users2, UserCircle } from "lucide-react";
import { AuthShell, AuthLogoLink } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrengthMeter } from "@/components/ui/password-strength";
import { Button } from "@/components/ui/button";
import { OAuthButtons, OAuthDivider } from "@/components/auth/OAuthButtons";
import { register } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";
import { isValidEmail, isValidPersonName, sanitizePersonName } from "@/lib/validation";

import i18n from "@/lib/i18n";

export const Route = createFileRoute("/register")({
  validateSearch: (s: Record<string, unknown>): { ref?: string } => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
  head: () => ({ meta: [{ title: i18n.t("pages.register.metaTitle") }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { ref } = useSearch({ from: "/register" });
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [emailError, setEmailError] = useState(false);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldError(false);
    setNameError(false);
    setEmailError(false);
    if (!agree) return toast.error(t("pages.register.agreeError"));
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim().toLowerCase();
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(form.get("password_confirmation") ?? "");
    if (!isValidPersonName(name)) {
      setNameError(true);
      return toast.error(t("pages.register.nameInvalid"));
    }
    if (!isValidEmail(email)) {
      setEmailError(true);
      return toast.error(t("pages.register.emailInvalid"));
    }
    if (password !== passwordConfirmation) {
      setFieldError(true);
      return toast.error(t("pages.register.passwordMismatch"));
    }
    setLoading(true);
    try {
      await register({ name, email, password, passwordConfirmation, referralCode: ref });
      toast.success(t("pages.register.registerSuccess"));
      nav({ to: "/verify-email", search: { email } });
    } catch (err) {
      setFieldError(true);
      const msg =
        err instanceof ApiError
          ? err.errors
            ? Object.values(err.errors)[0]?.[0] ?? err.message
            : err.message
          : t("pages.register.registerFailed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  const leftContent = (
    <>
      <AuthLogoLink size={40} />
      <div className="flex flex-col gap-[20px]">
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
          {t("authPages.registerTitle")}
        </h2>
        <p style={{ color: "rgba(255,255,255,0.75)", maxWidth: 420, fontSize: "var(--fs-body-lg)" }}>
          {t("authPages.registerSubtitle")}
        </p>
        <div className="flex flex-col gap-[14px]">
          {[
            { icon: Megaphone, text: t("authPages.registerBenefitAds") },
            { icon: Users2, text: t("authPages.registerBenefitCommunities") },
            { icon: UserCircle, text: t("authPages.registerBenefitProfile") },
          ].map(({ icon: Icon, text }) => (
            <div key={text} className="flex items-center gap-[12px]">
              <div
                className="grid shrink-0 place-items-center rounded-full"
                style={{ width: 36, height: 36, background: "var(--accent)", color: "#fff" }}
              >
                <Icon size={18} />
              </div>
              <span style={{ fontSize: "var(--fs-sm)", color: "rgba(255,255,255,0.9)" }}>{text}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "rgba(255,255,255,0.4)" }}>
        {t("authPages.loginQuote")}
      </div>
    </>
  );

  return (
    <AuthShell
      title={t("pages.register.title")}
      subtitle={t("pages.register.subtitle")}
      leftContent={leftContent}
      footer={
        <>
          {t("pages.register.hasAccount")}{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            {t("pages.register.loginLink")}
          </Link>
        </>
      }
    >
      {ref && (
        <div
          className="mb-[16px] flex items-center gap-[10px]"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent)",
            borderRadius: 12,
            padding: "10px 12px",
          }}
        >
          <div
            className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full"
            style={{ background: "var(--accent)", color: "#fff" }}
          >
            <UserPlus size={16} />
          </div>
          <div className="min-w-0 flex-1">
            <div style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
              {t("pages.register.referralTitle")}
            </div>
            <div style={{ fontSize: 11, color: "var(--foreground-50)" }}>
              {t("pages.register.referralDesc")}
            </div>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-[12px]">
        <Input
          required
          name="name"
          placeholder={t("pages.register.namePlaceholder")}
          maxLength={120}
          value={name}
          error={nameError}
          onChange={(e) => {
            const v = sanitizePersonName(e.target.value);
            setName(v);
            if (nameError) setNameError(!isValidPersonName(v));
          }}
          onBlur={() => setNameError(name.trim().length > 0 && !isValidPersonName(name))}
        />
        <Input
          required
          name="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          placeholder={t("auth.email")}
          value={email}
          error={emailError}
          onChange={(e) => {
            const v = e.target.value;
            setEmail(v);
            if (emailError) setEmailError(!isValidEmail(v));
          }}
          onBlur={() => setEmailError(email.trim().length > 0 && !isValidEmail(email))}
        />
        <PasswordInput
          required
          name="password"
          placeholder={t("pages.register.passwordPlaceholder")}
          minLength={8}
          error={fieldError}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrengthMeter password={password} />
        <PasswordInput required name="password_confirmation" placeholder={t("pages.register.passwordConfirmPlaceholder")} minLength={8} error={fieldError} />
        <label className="flex items-start gap-[10px]" style={{ fontSize: "var(--fs-xs)", color: "var(--foreground-70)", marginTop: 8 }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--accent)" }} />
          <span>
            {t("pages.register.agreePrefix")}{" "}
            <Link to="/legal/rules" style={{ color: "var(--accent)" }}>{t("pages.register.rulesLink")}</Link> {t("pages.register.andWord")}{" "}
            <Link to="/legal/privacy" style={{ color: "var(--accent)" }}>{t("pages.register.policyLink")}</Link> {t("pages.register.dataProcessing")}
          </span>
        </label>
        <Button type="submit" disabled={loading} className="w-full" style={{ marginTop: 16 }}>
          {loading ? t("pages.register.creating") : t("pages.register.create")}
        </Button>
      </form>
      <OAuthDivider />
      <OAuthButtons />
    </AuthShell>
  );
}
