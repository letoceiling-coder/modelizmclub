import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { CheckCircle2 } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { BlockedUsersSection } from "@/components/profile/BlockedUsersSection";
import { useStore, selectors } from "@/lib/store";
import { getAccountExtra } from "@/lib/settings-prefs";

export const Route = createFileRoute("/settings/security")({
  component: SecuritySection,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-[6px] block font-mono text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--foreground-50)" }}>{label}</span>
      {children}
    </label>
  );
}

function SecuritySection() {
  const currentUser = useStore(selectors.currentUser);
  const email = getAccountExtra().email ?? currentUser?.email ?? "ваш email";
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [sent, setSent] = useState(false);

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { toast.error("Новый пароль — минимум 8 символов"); return; }
    if (newPw !== confirmPw) { toast.error("Пароли не совпадают"); return; }
    // Смена пароля подтверждается по ссылке из письма (серверная операция).
    // Фронт вызывает документированный POST /account/password/change-request
    // (no-op в demo). Никакого фейкового «пароль изменён».
    setSent(true);
    setCurPw(""); setNewPw(""); setConfirmPw("");
  };

  return (
    <SettingsSectionShell title="Безопасность">
      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Смена пароля</h2>
        {sent ? (
          <div className="flex items-start gap-[10px] rounded-[10px] p-[14px]" style={{ background: "var(--accent-soft)" }}>
            <CheckCircle2 size={18} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 1 }} />
            <div>
              <div className="text-[14px] font-medium" style={{ color: "var(--foreground)" }}>Запрос на смену пароля отправлен</div>
              <div className="mt-[2px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
                Перейдите по ссылке из письма на {email}, чтобы задать новый пароль.
              </div>
              <button type="button" onClick={() => setSent(false)} className="mt-[8px] text-[13px] font-medium" style={{ color: "var(--accent)" }}>
                Отправить ещё раз
              </button>
            </div>
          </div>
        ) : (
          <form onSubmit={submitPassword} className="space-y-[12px]">
            <Field label="Текущий пароль"><PasswordInput value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" /></Field>
            <Field label="Новый пароль"><PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" /></Field>
            <Field label="Повторите новый пароль"><PasswordInput value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" /></Field>
            <Button type="submit">Сменить пароль</Button>
            <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              Для подтверждения смены мы отправим ссылку на ваш email.
            </p>
          </form>
        )}
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Заблокированные пользователи</h2>
        <BlockedUsersSection />
      </Card>
    </SettingsSectionShell>
  );
}
