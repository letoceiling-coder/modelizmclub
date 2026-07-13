import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { UserPlus, Megaphone, Users2, UserCircle } from "lucide-react";
import { AuthShell } from "@/components/auth/AuthShell";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { PasswordStrengthMeter } from "@/components/ui/password-strength";
import { PhoneInput } from "@/components/ui/phone-input";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { register } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

// Letters (Cyrillic + Latin), space, hyphen, apostrophe (straight or curly)
const NAME_PATTERN = /^[A-Za-zА-ЯЁа-яё\s'’-]+$/;

export const Route = createFileRoute("/register")({
  validateSearch: (s: Record<string, unknown>): { ref?: string } => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
  head: () => ({ meta: [{ title: "Регистрация — МоДелизМ" }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const nav = useNavigate();
  const { ref } = useSearch({ from: "/register" });
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [fieldError, setFieldError] = useState(false);
  const [nameError, setNameError] = useState(false);
  const [password, setPassword] = useState("");

  const submit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setFieldError(false);
    setNameError(false);
    if (!agree) return toast.error("Подтвердите согласие с правилами");
    const form = new FormData(e.currentTarget);
    const name = String(form.get("name") ?? "").trim();
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const passwordConfirmation = String(form.get("password_confirmation") ?? "");
    const phone = String(form.get("phone") ?? "").trim();
    if (!NAME_PATTERN.test(name) || name.length > 120) {
      setNameError(true);
      return toast.error("Имя может содержать только буквы, пробел, дефис и апостроф (до 120 символов)");
    }
    if (password !== passwordConfirmation) {
      setFieldError(true);
      return toast.error("Пароли не совпадают");
    }
    setLoading(true);
    try {
      await register({ name, email, password, passwordConfirmation, referralCode: ref, phone });
      toast.success("Аккаунт создан. Введите код из письма");
      nav({ to: "/verify-email", search: { email } });
    } catch (err) {
      setFieldError(true);
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

  const leftContent = (
    <>
      <Logo size={40} />
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
          Присоединяйтесь к сообществу моделистов
        </h2>
        <p style={{ color: "rgba(255,255,255,0.75)", maxWidth: 420, fontSize: "var(--fs-body-lg)" }}>
          Создайте аккаунт за минуту — и получите доступ к каталогу
          объявлений, тематическим сообществам и личному профилю моделиста.
        </p>
        <div className="flex flex-col gap-[14px]">
          {[
            { icon: Megaphone, text: "Объявления без комиссии" },
            { icon: Users2, text: "Сообщества по интересам" },
            { icon: UserCircle, text: "Личный профиль моделиста" },
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
        «Моделизм — это жизнь, остальное детали»
      </div>
    </>
  );

  return (
    <AuthShell
      title="Создать аккаунт"
      subtitle="Несколько секунд — и вы внутри сообщества"
      leftContent={leftContent}
      footer={
        <>
          Уже есть аккаунт?{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Войти
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
              Вы регистрируетесь по приглашению
            </div>
            <div style={{ fontSize: 11, color: "var(--foreground-50)" }}>
              Вы и пригласивший получите бонусное объявление
            </div>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-[12px]">
        <Input
          required
          name="name"
          placeholder="Имя и фамилия"
          maxLength={120}
          error={nameError}
          onChange={() => nameError && setNameError(false)}
        />
        <Input required name="email" type="email" placeholder="Email" />
        {/* Not sent to /auth/register yet — backend RegisterRequest has no phone
            field (see backend-endpoints-needed.md). Collected for UX now so the
            field/mask exist; wire it into submit() once the backend adds support. */}
        <PhoneInput name="phone" />
        <PasswordInput
          required
          name="password"
          placeholder="Пароль (от 8 символов)"
          minLength={8}
          error={fieldError}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        <PasswordStrengthMeter password={password} />
        <PasswordInput required name="password_confirmation" placeholder="Повторите пароль" minLength={8} error={fieldError} />
        <label className="flex items-start gap-[10px]" style={{ fontSize: "var(--fs-xs)", color: "var(--foreground-70)", marginTop: 8 }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--accent)" }} />
          <span>
            Я принимаю{" "}
            <Link to="/legal/rules" style={{ color: "var(--accent)" }}>правила сообщества</Link> и{" "}
            <Link to="/legal/privacy" style={{ color: "var(--accent)" }}>политику</Link> обработки данных
          </span>
        </label>
        <Button type="submit" disabled={loading} className="w-full" style={{ marginTop: 16 }}>
          {loading ? "Создаём…" : "Создать аккаунт"}
        </Button>
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
