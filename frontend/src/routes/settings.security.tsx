import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "@/lib/toast";
import { Loader2, LogOut } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { PasswordInput } from "@/components/ui/password-input";
import { BlockedUsersSection } from "@/components/profile/BlockedUsersSection";
import { isDemoMode } from "@/lib/demo-mode";
import { changePassword, logoutOtherDevices } from "@/lib/api/auth";
import { ApiError } from "@/lib/api/client";

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
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  // Authenticated in-place password change — current → new, no email round
  // trip, no logout. Demo hosts have no auth backend, so there we say so
  // honestly rather than faking "пароль изменён".
  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!curPw) { toast.error("Введите текущий пароль"); return; }
    if (newPw.length < 8) { toast.error("Новый пароль — минимум 8 символов"); return; }
    if (newPw !== confirmPw) { toast.error("Пароли не совпадают"); return; }
    if (isDemoMode()) { toast("В демо-режиме смена пароля недоступна"); return; }

    setSaving(true);
    try {
      await changePassword(curPw, newPw);
      toast.success("Пароль изменён");
      setCurPw(""); setNewPw(""); setConfirmPw("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const firstMessage = err.errors ? Object.values(err.errors)[0]?.[0] : undefined;
        toast.error(firstMessage ?? "Проверьте текущий пароль");
      } else {
        toast.error("Не удалось изменить пароль");
      }
    } finally {
      setSaving(false);
    }
  };

  const logoutOthers = async () => {
    if (isDemoMode()) { toast("В демо-режиме недоступно"); return; }
    setLoggingOut(true);
    try {
      await logoutOtherDevices();
      toast.success("Вы вышли на всех других устройствах");
    } catch {
      toast.error("Не удалось завершить другие сеансы");
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <SettingsSectionShell title="Безопасность">
      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <h2 className="mb-[4px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Смена пароля</h2>
        <p className="mb-[14px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
          Введите текущий и новый пароль — смена происходит сразу, без выхода из аккаунта.
        </p>
        <form onSubmit={submitPassword} className="space-y-[12px]">
          <Field label="Текущий пароль"><PasswordInput value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" /></Field>
          <Field label="Новый пароль"><PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Повторите новый пароль"><PasswordInput value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" /></Field>
          <Button type="submit" disabled={saving} className="gap-[8px]">
            {saving && <Loader2 size={16} className="animate-spin" />}
            Сменить пароль
          </Button>
        </form>
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <h2 className="mb-[4px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Активные сеансы</h2>
        <p className="mb-[14px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
          Если вы входили с чужого устройства — завершите все сеансы, кроме текущего. Здесь вы останетесь в системе.
        </p>
        <Button variant="outline" onClick={logoutOthers} disabled={loggingOut} className="gap-[8px]">
          {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
          Выйти на других устройствах
        </Button>
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Заблокированные пользователи</h2>
        <BlockedUsersSection />
      </Card>
    </SettingsSectionShell>
  );
}
