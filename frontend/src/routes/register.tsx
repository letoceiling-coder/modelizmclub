import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { getInviterByCode } from "@/lib/referral";
import { register } from "@/lib/api/auth";
import { setCurrentUser } from "@/lib/store";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/register")({
  validateSearch: (s: Record<string, unknown>) => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
  head: () => ({ meta: [{ title: "Регистрация — МоДелизМ Форум" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const nav = useNavigate();
  const { ref } = useSearch({ from: "/register" });
  const inviter = getInviterByCode(ref);
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!agree) return toast.error("Подтвердите согласие с правилами");
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    setLoading(true);
    try {
      const { user, needsVerification } = await register({ name, email, password });
      if (needsVerification) {
        toast.success("Аккаунт создан. Подтвердите email по ссылке из письма");
        nav({ to: "/login" });
        return;
      }
      setCurrentUser(user);
      toast.success(inviter ? `Аккаунт создан. Приглашён ${inviter.name}` : "Аккаунт создан");
      nav({ to: "/onboarding" });
    } catch (err) {
      const msg =
        err instanceof ApiError
          ? err.errors
            ? Object.values(err.errors)[0]?.[0] ?? err.message
            : err.message
          : "Не удалось зарегистрироваться. Попробуйте позже";
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Создать аккаунт"
      subtitle="Несколько секунд — и вы внутри сообщества"
      footer={
        <>
          Уже есть аккаунт?{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Войти
          </Link>
        </>
      }
    >
      {inviter && (
        <div
          className="mb-[16px] flex items-center gap-[10px]"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent)",
            borderRadius: 12,
            padding: "10px 12px",
          }}
        >
          <img src={inviter.avatar} alt="" className="h-[32px] w-[32px] rounded-full object-cover" />
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-[6px]" style={{ fontSize: 12, color: "var(--accent)", fontWeight: 600 }}>
              <UserPlus size={12} /> Приглашён {inviter.name}
            </div>
            <div style={{ fontSize: 11, color: "var(--foreground-50)" }}>
              Вы и {inviter.name.split(" ")[0]} получите по бонусному объявлению
            </div>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-[12px]">
        <input required name="name" placeholder="Имя и фамилия" style={inputStyle} />
        <input required name="email" type="email" placeholder="Email" style={inputStyle} />
        <input required name="password" type="password" placeholder="Пароль (от 8 символов)" minLength={8} style={inputStyle} />
        <label className="flex items-start gap-[10px]" style={{ fontSize: "var(--fs-xs)", color: "var(--foreground-70)", marginTop: 8 }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--accent)" }} />
          <span>
            Я принимаю{" "}
            <Link to="/legal/rules" style={{ color: "var(--accent)" }}>правила сообщества</Link> и{" "}
            <Link to="/legal/privacy" style={{ color: "var(--accent)" }}>политику</Link> обработки данных
          </span>
        </label>
        <button type="submit" disabled={loading} style={{ ...primaryBtn, marginTop: 16, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Создаём…" : "Создать аккаунт"}
        </button>
      </form>
      <div className="mt-[24px] flex items-center gap-[12px]" style={{ color: "var(--foreground-50)", fontSize: "var(--fs-xs)" }}>
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        ИЛИ
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
      </div>
      <div className="mt-[16px] grid grid-cols-2 gap-[8px]">
        {["VK", "Яндекс"].map((p) => (
          <button
            key={p}
            type="button"
            style={{
              background: "var(--background-surface)",
              border: "1px solid var(--border)",
              padding: "10px 14px",
              borderRadius: "var(--r-button)",
              fontSize: "var(--fs-sm)",
              color: "var(--foreground)",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            {p}
          </button>
        ))}
      </div>
    </AuthShell>
  );
}
