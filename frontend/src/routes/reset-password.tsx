import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "@/lib/toast";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { resetPassword } from "@/lib/api/auth";
import { resetSessionCache, syncFavoritesFromServer } from "@/lib/auth/session";
import { setCurrentUser } from "@/lib/store";
import { PasswordStrengthMeter } from "@/components/ui/password-strength";
import { FieldMessage } from "@/components/ui/field-message";
import { passwordMatchState } from "@/lib/password-match";
import { revealAndFocus } from "@/lib/ui/reveal-and-focus";
import { ApiError } from "@/lib/api/client";
import i18n from "@/lib/i18n";

/** Matches this page's raw `inputStyle` fields (not the shared UI Kit `Input`
 *  component) — a lightweight local eye-toggle keeps the visual style
 *  consistent with the email field on the same form. */
function PasswordFieldWithToggle({
  showLabel,
  hideLabel,
  error,
  inputRef,
  ...props
}: React.InputHTMLAttributes<HTMLInputElement> & {
  showLabel: string;
  hideLabel: string;
  /** Красная рамка — того же цвета, что у общего `Input`: `var(--danger)`. */
  error?: boolean;
  inputRef?: (el: HTMLInputElement | null) => void;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input
        {...props}
        ref={inputRef}
        type={visible ? "text" : "password"}
        aria-invalid={error ? true : undefined}
        style={{
          ...inputStyle,
          paddingRight: 40,
          border: `1px solid ${error ? "var(--danger)" : "var(--border)"}`,
        }}
      />
      {/*
        Кнопка остаётся в порядке обхода клавиатурой — как и в общем
        `PasswordInput`. Стояло `tabIndex={-1}`: показать пароль мышью было
        можно, с клавиатуры нет. Человеку, который не пользуется мышью,
        опечатку в невидимом пароле найти нечем.
      */}
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        aria-pressed={visible}
        aria-label={visible ? hideLabel : showLabel}
        style={{
          position: "absolute",
          right: 10,
          top: "50%",
          transform: "translateY(-50%)",
          display: "grid",
          placeItems: "center",
          width: 28,
          height: 28,
          borderRadius: "999px",
          color: "var(--foreground-50)",
          background: "transparent",
          border: "none",
          cursor: "pointer",
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

/** Поля в том порядке, в каком они стоят на экране: по нему выбирается
 *  первое проблемное место для прокрутки и фокуса. */
type Поле = "email" | "password" | "confirmation";

const ПОРЯДОК: Поле[] = ["email", "password", "confirmation"];

const ПОЛЕ_ПО_КЛЮЧУ_СЕРВЕРА: Record<string, Поле> = {
  email: "email",
  password: "password",
};

function ResetPasswordPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { token: rawToken, email: initialEmail } = useSearch({ from: "/reset-password" });
  const token = rawToken ?? "";
  const [email, setEmail] = useState(initialEmail ?? "");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [confirmationLeft, setConfirmationLeft] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<Поле, string>>>({});
  const [loading, setLoading] = useState(false);
  const узлы = useRef<Partial<Record<Поле, HTMLElement | null>>>({});

  /*
   * Решение Ж1 от 09.10 — то же правило, что в регистрации и в смене пароля
   * в настройках, из `lib/password-match.ts`.
   *
   * Было: о несовпадении человек узнавал всплывающим сообщением после
   * нажатия «Сохранить пароль», поле повтора вообще не имело состояния —
   * оно было неуправляемым, и значение читалось из `FormData` при отправке.
   */
  const совпадение = passwordMatchState(password, confirmation, { left: confirmationLeft });

  const повтор: { tone: "error" | "ok"; текст: string } | null = errors.confirmation
    ? { tone: "error", текст: errors.confirmation }
    : совпадение === "mismatch"
      ? { tone: "error", текст: t("passwordField.mismatch") }
      : совпадение === "match"
        ? { tone: "ok", текст: t("passwordField.match") }
        : null;

  const очистить = (поле: Поле) =>
    setErrors((прежние) => {
      if (!(поле in прежние)) return прежние;
      const копия = { ...прежние };
      delete копия[поле];
      return копия;
    });

  const показатьПервое = (найденные: Partial<Record<Поле, string>>) => {
    const первое = ПОРЯДОК.find((поле) => найденные[поле]);
    if (первое) revealAndFocus(узлы.current[первое]);
  };

  /* Требования к паролю — те же, что на сервере: `Password::min(8)`. */
  const проблемы = (): Array<[Поле, string]> => {
    const список: Array<[Поле, string]> = [];
    if (!email.trim()) список.push(["email", t("pages.register.emailRequired")]);
    if (!password) список.push(["password", t("passwordField.required")]);
    else if (password.length < 8) список.push(["password", t("passwordField.tooShort")]);
    if (!confirmation) список.push(["confirmation", t("passwordField.confirmRequired")]);
    else if (confirmation !== password) список.push(["confirmation", t("passwordField.mismatch")]);
    return список;
  };

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    const найденные = Object.fromEntries(проблемы()) as Partial<Record<Поле, string>>;
    if (Object.keys(найденные).length > 0) {
      setErrors(найденные);
      setConfirmationLeft(true);
      показатьПервое(найденные);
      return;
    }

    /* Недействительная ссылка — не поле формы: исправить её человек не
       может, и показывать такой отказ у поля значило бы соврать о причине. */
    if (!token) {
      toast.error(t("pages.resetPassword.invalidLink"));
      return;
    }

    setErrors({});
    setLoading(true);
    try {
      const { user } = await resetPassword({
        email: email.trim().toLowerCase(),
        token,
        password,
        passwordConfirmation: confirmation,
      });
      resetSessionCache();
      setCurrentUser(user);
      void syncFavoritesFromServer();
      toast.success(t("pages.resetPassword.success"));
      nav({ to: "/feed", replace: true });
    } catch (err) {
      const кПолям: Partial<Record<Поле, string>> = {};
      if (err instanceof ApiError && err.errors) {
        for (const [ключ, сообщения] of Object.entries(err.errors)) {
          const поле = ПОЛЕ_ПО_КЛЮЧУ_СЕРВЕРА[ключ];
          const текст = сообщения?.[0];
          if (поле && текст) кПолям[поле] = текст;
        }
      }
      if (Object.keys(кПолям).length > 0) {
        setErrors(кПолям);
        показатьПервое(кПолям);
      } else {
        toast.error(err instanceof ApiError ? err.message : t("pages.resetPassword.failed"));
      }
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
      {/* noValidate — проверку делаем мы. Пока её делал браузер, он показывал
          свой пузырь у первого пустого поля, и до наших подписей дело не
          доходило. */}
      <form onSubmit={submit} className="space-y-[12px]" autoComplete="on" noValidate>
        <div>
          <input
            required
            name="email"
            type="email"
            autoComplete="email"
            placeholder={t("auth.email")}
            value={email}
            readOnly={Boolean(initialEmail)}
            aria-invalid={errors.email ? true : undefined}
            aria-describedby={errors.email ? "reset-email-msg" : undefined}
            ref={(el) => {
              узлы.current.email = el;
            }}
            onChange={(e) => {
              setEmail(e.target.value);
              if (errors.email && e.target.value.trim()) очистить("email");
            }}
            style={{
              ...inputStyle,
              border: `1px solid ${errors.email ? "var(--danger)" : "var(--border)"}`,
            }}
          />
          {errors.email && (
            <FieldMessage id="reset-email-msg" tone="error">
              {errors.email}
            </FieldMessage>
          )}
        </div>
        <div>
          <PasswordFieldWithToggle
            required
            name="password"
            autoComplete="new-password"
            placeholder={t("pages.resetPassword.newPasswordPlaceholder")}
            minLength={8}
            value={password}
            error={Boolean(errors.password)}
            aria-describedby={errors.password ? "reset-password-msg" : undefined}
            showLabel={t("pages.resetPassword.showPassword")}
            hideLabel={t("pages.resetPassword.hidePassword")}
            inputRef={(el) => {
              узлы.current.password = el;
            }}
            onChange={(e) => {
              const v = e.target.value;
              setPassword(v);
              if (errors.password && v.length >= 8) очистить("password");
              /* Правка первого пароля пересчитывает состояние второго. */
              if (errors.confirmation) очистить("confirmation");
            }}
          />
          {errors.password && (
            <FieldMessage id="reset-password-msg" tone="error">
              {errors.password}
            </FieldMessage>
          )}
        </div>
        <PasswordStrengthMeter password={password} />
        <div>
          <PasswordFieldWithToggle
            required
            name="password_confirmation"
            autoComplete="new-password"
            placeholder={t("pages.resetPassword.confirmPlaceholder")}
            minLength={8}
            value={confirmation}
            error={повтор?.tone === "error"}
            aria-describedby={повтор ? "reset-confirm-msg" : undefined}
            showLabel={t("pages.resetPassword.showPassword")}
            hideLabel={t("pages.resetPassword.hidePassword")}
            inputRef={(el) => {
              узлы.current.confirmation = el;
            }}
            onChange={(e) => {
              setConfirmation(e.target.value);
              /* Снова печатает — значит снова набор, а не брошенное поле. */
              setConfirmationLeft(false);
              if (errors.confirmation) очистить("confirmation");
            }}
            onBlur={() => setConfirmationLeft(true)}
          />
          {повтор && (
            <FieldMessage id="reset-confirm-msg" tone={повтор.tone}>
              {повтор.текст}
            </FieldMessage>
          )}
        </div>
        <button
          type="submit"
          disabled={loading}
          style={{ ...primaryBtn, marginTop: 8, opacity: loading ? 0.7 : 1 }}
        >
          {loading ? t("pages.resetPassword.saving") : t("pages.resetPassword.saveButton")}
        </button>
      </form>
    </AuthShell>
  );
}
