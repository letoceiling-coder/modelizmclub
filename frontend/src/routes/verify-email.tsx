import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { authErrorMessage, verifyEmail } from "@/lib/api/auth";
import { applySession } from "@/lib/auth/session";

export const Route = createFileRoute("/verify-email")({
  validateSearch: (s: Record<string, unknown>) => ({
    email: typeof s.email === "string" ? s.email : "",
  }),
  head: () => ({ meta: [{ title: "Подтверждение email — МоДелизМ Форум" }] }),
  component: VerifyEmailPage,
});

function VerifyEmailPage() {
  const nav = useNavigate();
  const { email: initialEmail } = useSearch({ from: "/verify-email" });
  const [email, setEmail] = useState(initialEmail);
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const { user, token } = await verifyEmail(email.trim(), code.trim());
      applySession(user, token);
      toast.success("Email подтверждён");
      nav({ to: "/onboarding" });
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Подтверждение email"
      subtitle="Введите 6-значный код из письма"
      footer={
        <>
          Уже подтверждали?{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Войти
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
        <input
          required
          inputMode="numeric"
          pattern="[0-9]{6}"
          maxLength={6}
          placeholder="Код из письма"
          value={code}
          onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
          style={inputStyle}
        />
        <button type="submit" disabled={loading} style={{ ...primaryBtn, marginTop: 8, opacity: loading ? 0.7 : 1 }}>
          {loading ? "Проверяем…" : "Подтвердить"}
        </button>
      </form>
    </AuthShell>
  );
}
