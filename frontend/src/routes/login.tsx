import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
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
    setLoading(true);
    try {
      const user = await login(email, password);
      resetSessionCache();
      setCurrentUser(user);
      toast.success("Вход выполнен");
      const target = redirectTo?.startsWith("/") ? redirectTo : "/feed";
      nav({ to: target as "/feed" });
    } catch (err) {
      setFieldError(true);
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
          С возвращением
        </h2>
        <p style={{ color: "rgba(255,255,255,0.75)", marginTop: 16, maxWidth: 420, fontSize: "var(--fs-body-lg)" }}>
          Входите и продолжайте общаться с сообществом моделистов.
        </p>
      </div>
      <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", color: "rgba(255,255,255,0.4)" }}>
        «Моделизм — это жизнь, остальное детали»
      </div>
    </>
  );

  return (
    <AuthShell
      title="Вход"
      subtitle="С возвращением в МоДелизМ"
      leftContent={leftContent}
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
        <Input required name="email" type="email" placeholder="Email или телефон" error={fieldError} />
        <Input required name="password" type="password" placeholder="Пароль" error={fieldError} />
        <div className="flex items-center justify-between" style={{ fontSize: "var(--fs-xs)" }}>
          <label className="flex items-center gap-[8px]" style={{ color: "var(--foreground-70)" }}>
            <input type="checkbox" defaultChecked style={{ accentColor: "var(--accent)" }} />
            Запомнить меня
          </label>
          <Link to="/recover" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Забыли пароль?
          </Link>
        </div>
        <Button type="submit" disabled={loading} className="w-full" style={{ marginTop: 8 }}>
          {loading ? "Входим…" : "Войти"}
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
