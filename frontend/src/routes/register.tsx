import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link, useNavigate, useSearch } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { UserPlus } from "lucide-react";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";
import { getInviterByCode } from "@/lib/referral";
import { useAuth } from "@/components/auth/AuthProvider";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/register")({
  validateSearch: (s: Record<string, unknown>) => ({
    ref: typeof s.ref === "string" ? s.ref : undefined,
  }),
  head: () => ({ meta: [{ title: tStatic("auth.registerMetaTitle") }] }),
  component: RegisterPage,
});

function RegisterPage() {
  const { t } = useTranslation();
  const nav = useNavigate();
  const { ref } = useSearch({ from: "/register" });
  const inviter = getInviterByCode(ref);
  const { register } = useAuth();
  const [agree, setAgree] = useState(true);
  const [loading, setLoading] = useState(false);
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!agree) return toast.error(t("auth.agreeError"));
    setLoading(true);
    try {
      await register({
        email: email.trim(),
        password,
        password_confirmation: password,
        display_name: displayName.trim() || undefined,
      });
      toast.success(t("auth.registerCodeSent"));
      nav({ to: "/verify-email", search: { email: email.trim() } });
    } catch (err) {
      const msg = err instanceof ApiError ? err.message : t("auth.registerFailed");
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthShell
      title={t("auth.submitRegister")}
      subtitle={t("auth.registerSubtitle")}
      footer={
        <>
          {t("auth.hasAccount")}{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>{t("index.heroLogin")}</Link>
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
              <UserPlus size={12} /> {t("auth.invited", { name: inviter.name })}
            </div>
            <div style={{ fontSize: 11, color: "var(--foreground-50)" }}>
              {t("auth.bonusNote", { name: inviter.name.split(" ")[0] })}
            </div>
          </div>
        </div>
      )}
      <form onSubmit={submit} className="space-y-[12px]">
        <input
          required
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder={t("auth.namePlaceholder")}
          style={inputStyle}
        />
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="Email"
          style={inputStyle}
        />
        <input
          required
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder={t("auth.passwordMinPlaceholder")}
          minLength={8}
          style={inputStyle}
        />
        <label className="flex items-start gap-[10px]" style={{ fontSize: "var(--fs-xs)", color: "var(--foreground-70)", marginTop: 8 }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} style={{ marginTop: 3, accentColor: "var(--accent)" }} />
          <span>
            {t("auth.agreePrefix")}{" "}
            <Link to="/legal/rules" style={{ color: "var(--accent)" }}>{t("auth.rulesLink")}</Link> {t("auth.and")}{" "}
            <Link to="/legal/privacy" style={{ color: "var(--accent)" }}>{t("auth.privacyLink")}</Link>{t("auth.privacySuffix")}</span>
        </label>
        <button type="submit" disabled={loading} style={{ ...primaryBtn, marginTop: 16, opacity: loading ? 0.7 : 1 }}>
          {loading ? t("auth.submittingRegister") : t("auth.submitRegister")}
        </button>
      </form>
      <div className="mt-[24px] flex items-center gap-[12px]" style={{ color: "var(--foreground-50)", fontSize: "var(--fs-xs)" }}>
        <span style={{ flex: 1, height: 1, background: "var(--border)" }} />
        {t("common.or")}
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
