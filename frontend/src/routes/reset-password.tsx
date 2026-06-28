import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { resetPassword } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/reset-password")({
  validateSearch: (s: Record<string, unknown>): { token?: string; email?: string } => ({
    token: typeof s.token === "string" ? s.token : "",
    email: typeof s.email === "string" ? s.email : "",
  }),
  head: () => ({ meta: [{ title: "Новый пароль — МоДелизМ Форум" }] }),
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
        <input required name="password" type="password" placeholder="Новый пароль (от 8 символов)" minLength={8} style={inputStyle} />
        <input required name="password_confirmation" type="password" placeholder="Повторите пароль" minLength={8} style={inputStyle} />
        <button type="submit" disabled={loading} style={{ ...primaryBtn, marginTop: 8, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Сохраняем…" : "Сохранить пароль"}
        </button>
      </form>
    </AuthShell>
  );
}
