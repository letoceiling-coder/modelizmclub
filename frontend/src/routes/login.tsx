import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/login")({
  head: () => ({ meta: [{ title: "Вход — МоДелизМ Форум" }] }),
  component: LoginPage,
});

function LoginPage() {
  const nav = useNavigate();
  const [loading, setLoading] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => {
      toast.success("Вход выполнен (демо)");
      nav({ to: "/feed" });
    }, 400);
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
        <input required type="email" placeholder="Email или телефон" style={inputStyle} />
        <input required type="password" placeholder="Пароль" style={inputStyle} />
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
