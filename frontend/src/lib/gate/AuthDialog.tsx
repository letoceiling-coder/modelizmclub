import { useState, type FormEvent } from "react";
import { LogIn } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { OAuthButtons, OAuthDivider } from "@/components/auth/OAuthButtons";
import { login } from "@/lib/api/auth";
import { ensureSession, resetSessionCache } from "@/lib/auth/session";
import { setCurrentUser } from "@/lib/store";
import { GateDialogShell } from "./GateDialogShell";

interface Props {
  open: boolean;
  returnTo?: string;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

/** Sign in without leaving the page — the action resumes right after. */
export function AuthDialog({ open, returnTo, onOpenChange, onSuccess }: Props) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const email = String(form.get("email") ?? "").trim();
    const password = String(form.get("password") ?? "");
    const remember = form.get("remember") === "on";
    if (!email || !password) return;
    setBusy(true);
    setError(null);
    try {
      const user = await login(email, password, remember);
      resetSessionCache();
      setCurrentUser(user);
      await ensureSession();
      onSuccess();
    } catch (err) {
      setError(
        err instanceof Error && err.message
          ? err.message
          : "Не удалось войти. Проверьте почту и пароль.",
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <GateDialogShell
      open={open}
      onOpenChange={onOpenChange}
      title="Войдите или зарегистрируйтесь"
      description="Это действие доступно только участникам клуба."
      icon={<LogIn size={22} />}
    >
      <form onSubmit={submit} className="space-y-3">
        <Input
          name="email"
          type="email"
          autoComplete="email"
          placeholder="Почта"
          required
          className="h-11"
        />
        <Input
          name="password"
          type="password"
          autoComplete="current-password"
          placeholder="Пароль"
          required
          className="h-11"
        />
        <label
          className="flex items-center gap-2 text-[13px]"
          style={{ color: "var(--foreground-70)" }}
        >
          <input
            type="checkbox"
            name="remember"
            defaultChecked
            style={{ accentColor: "var(--accent)" }}
          />
          Запомнить меня
        </label>
        {error && (
          <p className="text-[13px]" style={{ color: "var(--error)" }} role="alert">
            {error}
          </p>
        )}
        <Button type="submit" size="lg" className="w-full" loading={busy}>
          Войти
        </Button>
      </form>
      <OAuthDivider />
      <OAuthButtons redirect={returnTo} />
      <p className="mt-4 text-center text-[13px]" style={{ color: "var(--foreground-70)" }}>
        Нет аккаунта?{" "}
        <Link
          to="/register"
          search={{ returnTo }}
          className="font-semibold"
          style={{ color: "var(--accent)" }}
          onClick={() => onOpenChange(false)}
        >
          Зарегистрироваться
        </Link>
      </p>
    </GateDialogShell>
  );
}
