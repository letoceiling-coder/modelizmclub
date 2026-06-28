import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { login } from "@/lib/api/auth";
import { setCurrentUser } from "@/lib/store";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Вход — МоДелизМ Форум" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setLoading(true);
    try {
      const user = await login(email, password);
      setCurrentUser(user);
      toast.success("Вход выполнен");
      nav({ to: "/feed" });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.status === 401 || err.status === 422
            ? "Неверный email или пароль"
            : err.message
          : "Не удалось войти. Попробуйте позже";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Вход"
      subtitle="С возвращением в МоДелизМ Форум"
      footer={
        <>
          Ещё нет аккаунта?{" "}
          <Link to="/register" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Зарегистрироваться
          </Link>
        </>
      }
    >
      <form onSubmit={submit} className="space-y-[12px]">
        <input required name="email" type="email" placeholder="Email или телефон" style={inputStyle} />
        <input required name="password" type="password" placeholder="Пароль" style={inputStyle} />
        <div className="flex items-center justify-between" style={{ fontSize: "var(--fs-xs)" }}>
          <label className="flex items-center gap-[8px]" style={{ color: "var(--foreground-70)" }}>
            <input type="checkbox" defaultChecked style={{ accentColor: "var(--accent)" }} />
            Запомнить меня
          </label>
          <Link to="/recover" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Забыли пароль?
          </Link>
        </div>
        <button type="submit" disabled={loading} style={{ ...primaryBtn, opacity: loading ? 0.7 : 1, marginTop: 8 }}>
          {loading ? "Входим…" : "Войти"}
        </button>
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
