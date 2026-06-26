import { useTranslation, tStatic } from "@/lib/i18n";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AuthShell, inputStyle, primaryBtn } from "@/components/auth/AuthShell";

export const Route = createFileRoute("/recover")({
  head: () => ({ meta: [{ title: tStatic("auth.recoverMetaTitle") }] }),
  component: RecoverPage,
});

function RecoverPage() {
  const { t } = useTranslation();
  const [sent, setSent] = useState(false);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setSent(true);
    toast.success(t("auth.emailSent"));
  };

  return (
    <AuthShell
      title={t("auth.recoverTitle")}
      subtitle={t("auth.recoverSubtitle")}
      footer={
        <>
          {t("auth.remembered")}{" "}
          <Link to="/login" style={{ color: "var(--accent)", fontWeight: 600 }}>{t("auth.backToLogin")}</Link>
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
        >{t("auth.emailSentNote")}</div>
      ) : (
        <form onSubmit={submit} className="space-y-[12px]">
          <input required type="email" placeholder={t("auth.emailPlaceholder")} style={inputStyle} />
          <button type="submit" style={{ ...primaryBtn, marginTop: 8 }}>{t("auth.sendLink")}</button>
        </form>
      )}
    </AuthShell>
  );
}
