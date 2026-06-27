import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { authErrorMessage, forgotPassword } from "@/lib/api/auth";

export const Route = createFileRoute("/recover")({
  head: () => ({ meta: [{ title: "Восстановление пароля — МоДелизМ Форум" }] }),
  component: RecoverPage,
});

function RecoverPage() {
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await forgotPassword(email.trim());
      setSent(true);
      toast.success("Если email зарегистрирован — письмо отправлено");
    } catch (err) {
      toast.error(authErrorMessage(err));
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title="Восстановление пароля"
      subtitle="Мы пришлём ссылку для сброса на ваш email"
      footer={
        <>
          Вспомнили пароль?{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>
            Вернуться ко входу
          </Link>
        </>
      }
    >
      {sent ? (
        <div
          style={{
            background: "var(--success-soft)",
            border: "1px solid var(--success)",
            color: "var(--foreground)",
            padding: 16,
            borderRadius: "var(--r-card-sm)",
            fontSize: "var(--fs-sm)",
          }}
        >
          Если такой email зарегистрирован — письмо со ссылкой уже у вас в почте. Проверьте папку «Спам».
        </div>
      ) : (
        <form onSubmit={submit} className="space-y-[12px]">
          <input
            required
            type="email"
            placeholder="Ваш email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={inputStyle}
          />
          <button type="submit" disabled={loading} style={{ ...primaryBtn, marginTop: 8, opacity: loading ? 0.7 : 1 }}>
            {loading ? "Отправляем…" : "Отправить ссылку"}
          </button>
        </form>
      )}
    </AuthShell>
  );
}
