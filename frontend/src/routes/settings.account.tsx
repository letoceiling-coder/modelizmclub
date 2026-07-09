import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ChevronRight } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";

export const Route = createFileRoute("/settings/account")({
  component: AccountSection,
});

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-[6px] block font-mono text-[12px] uppercase tracking-[0.05em]" style={{ color: "var(--foreground-50)" }}>{label}</span>
      {children}
    </label>
  );
}

function AccountSection() {
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [email, setEmail] = useState("");

  const submitPassword = (e: React.FormEvent) => {
    e.preventDefault();
    if (newPw.length < 8) { toast.error("Новый пароль — минимум 8 символов"); return; }
    if (newPw !== confirmPw) { toast.error("Пароли не совпадают"); return; }
    toast("Смена пароля: будет доступно позже");
  };

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { toast.error("Введите корректный email"); return; }
    toast("Смена email: будет доступно позже");
  };

  return (
    <SettingsSectionShell title="Профиль и аккаунт">
      <Link
        to="/profile"
        className="flex items-center gap-[12px] rounded-[12px] border px-[16px] py-[14px] transition-colors hover:bg-[var(--background-surface)]"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium" style={{ color: "var(--foreground)" }}>Публичный профиль</div>
          <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>Аватар, обложка, имя, город, интересы</div>
        </div>
        <ChevronRight size={18} style={{ color: "var(--foreground-30)" }} />
      </Link>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Смена пароля</h2>
        <form onSubmit={submitPassword} className="space-y-[12px]">
          <Field label="Текущий пароль"><PasswordInput value={curPw} onChange={(e) => setCurPw(e.target.value)} autoComplete="current-password" /></Field>
          <Field label="Новый пароль"><PasswordInput value={newPw} onChange={(e) => setNewPw(e.target.value)} autoComplete="new-password" /></Field>
          <Field label="Повторите новый пароль"><PasswordInput value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} autoComplete="new-password" /></Field>
          <Button type="submit" className="rounded-[10px]">Сменить пароль</Button>
        </form>
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>Смена email</h2>
        <form onSubmit={submitEmail} className="space-y-[12px]">
          <Field label="Новый email"><Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" /></Field>
          <Button type="submit" className="rounded-[10px]">Изменить email</Button>
        </form>
      </Card>
    </SettingsSectionShell>
  );
}
