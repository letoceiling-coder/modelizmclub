import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

/** Matches this page's raw `inputStyle` fields (not the shared UI Kit `Input`
 *  component) — a lightweight local eye-toggle keeps the visual style
 *  consistent with the email field on the same form. */
function PasswordFieldWithToggle(props: React.InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  return (
    <div style={{ position: "relative" }}>
      <input {...props} type={visible ? "text" : "password"} style={{ ...inputStyle, paddingRight: 40 }} />
      <button
        type="button"
        onClick={() => setVisible((v) => !v)}
        tabIndex={-1}
        aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
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
  head: () => ({ meta: [{ title: "Новый пароль — МоДелизМ" }] }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const nav = useNavigate();
  const { token, email: initialEmail } = useSearch({ from: "/reset-password" });
  const [email, setEmail] = useState(initialEmail ?? "");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(form.get("password_confirmation") ?? "");
    if (password !== passwordConfirmation) {
      return toast.error("Пароли не совпадают");
    }
    if (!token) {
      return toast.error("Ссылка для сброса недействительна. Запросите новую");
    }
    setLoading(true);
    try {
      await resetPassword({ email: email.trim(), token, password, passwordConfirmation });
      toast.success("Пароль изменён. Войдите с новым паролем");
      nav({ to: "/login" });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.errors
            ? Object.values(err.errors)[0]?.[0] ?? err.message
            : err.message
          : "Не удалось изменить пароль. Запросите ссылку заново";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Новый пароль"
      subtitle="Придумайте новый пароль для входа"
      footer={
        <>
          Вспомнили пароль?{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Вернуться ко входу
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-[12px]">
        <input
          required
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          style={inputStyle}
        />
        <PasswordFieldWithToggle required name="password" placeholder="Новый пароль (от 8 символов)" minLength={8} />
        <PasswordFieldWithToggle required name="password_confirmation" placeholder="Повторите пароль" minLength={8} />
        <button type="submit" disabled={loading} style={{ ...primaryBtn, marginTop: 8, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Сохраняем…" : "Сохранить пароль"}
        </button>
      </form>
    </AuthShell>
  );
}
