import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "@/lib/toast";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { resetPassword } from "@/lib/api/auth";
import { resetSessionCache, syncFavoritesFromServer } from "@/lib/auth/session";
import { setCurrentUser } from "@/lib/store";
import { PasswordStrengthMeter } from "@/components/ui/password-strength";
import { ApiError } from "@/lib/api/client";
import i18n from "@/lib/i18n";

/** Matches this page's raw `inputStyle` fields (not the shared UI Kit `Input`
 *  component) — a lightweight local eye-toggle keeps the visual style
 *  consistent with the email field on the same form. */
function PasswordFieldWithToggle({
  showLabel,
  hideLabel,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & { showLabel: string; hideLabel: string }) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input {...props} type={visible ? "text" : "password"} style={{ ...inputStyle, paddingRight: 40 }} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? hideLabel : showLabel}
        style={{
          position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
          display: "grid", placeItems: "center", width: 28, height: 28, borderRadius: "999px",
          color: "var(--foreground-50)", background: "transparent", border: "none", cursor: "pointer",
        }}
      >
        {visible ? <EyeOff size={16} /> : <Eye size={16} />}
      </button>
    </div>
  );
}

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): { token?: string; email?: string } => ({
    token: typeof s.token === "string" ? s.token : "",
    email: typeof s.email === "string" ? s.email : "",
  }),
  head: () => ({ meta: [{ title: i18n.t("pages.resetPassword.metaTitle") }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { token: rawToken, email: initialEmail } = useSearch({ from: "/reset-password" });
  const token = rawToken ?? "";
  const [email, setEmail] = useState(initialEmail ?? "");
  const [passwordPreview, setPasswordPreview] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(form.get("password_confirmation") ?? "");
    const normalizedEmail = String(form.get("email") ?? email).trim().toLowerCase();

    if (password !== passwordConfirmation) {
      return toast.error(t("pages.resetPassword.passwordMismatch"));
    }
    if (!password || password.length < 8) {
      return toast.error(t("pages.resetPassword.passwordTooShort"));
    }
    if (!token) {
      return toast.error(t("pages.resetPassword.invalidLink"));
    }

    setLoading(true);
    try {
      const { user } = await resetPassword({ email: normalizedEmail, token, password, passwordConfirmation });
      resetSessionCache();
      setCurrentUser(user);
      void syncFavoritesFromServer();
      toast.success(t("pages.resetPassword.success"));
      nav({ to: "/feed", replace: true });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.errors
            ? Object.values(err.errors)[0]?.[0] ?? err.message
            : err.message
          : t("pages.resetPassword.failed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t("pages.resetPassword.title")}
      subtitle={t("pages.resetPassword.subtitle")}
      footer={
        <>
          {t("pages.resetPassword.rememberPassword")}{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            {t("pages.resetPassword.backToLogin")}
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-[12px]" autoComplete="on">
        <input
          required
          name="email"
          type="email"
          autoComplete="email"
          placeholder={t("auth.email")}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          readOnly={Boolean(initialEmail)}
          style={inputStyle}
        />
        <PasswordFieldWithToggle
          required
          name="password"
          autoComplete="new-password"
          placeholder={t("pages.resetPassword.newPasswordPlaceholder")}
          minLength={8}
          showLabel={t("pages.resetPassword.showPassword")}
          hideLabel={t("pages.resetPassword.hidePassword")}
          onChange={(e) => setPasswordPreview(e.target.value)}
        />
        <PasswordStrengthMeter password={passwordPreview} />
        <PasswordFieldWithToggle
          required
          name="password_confirmation"
          autoComplete="new-password"
          placeholder={t("pages.resetPassword.confirmPlaceholder")}
          minLength={8}
          showLabel={t("pages.resetPassword.showPassword")}
          hideLabel={t("pages.resetPassword.hidePassword")}
        />
        <button type="submit" disabled={loading} style={{ ...primaryBtn, marginTop: 8, opacity: loading ? 0.7 : 1 }}>
          {loading ? t("pages.resetPassword.saving") : t("pages.resetPassword.saveButton")}
        </button>
      </form>
    </AuthShell>
  );
}
