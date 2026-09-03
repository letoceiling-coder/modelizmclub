import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { useTranslation } from "react-i18next";
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
      <span
        className="mb-[6px] block font-mono text-[12px] uppercase tracking-[0.05em]"
        style={{ color: "var(--foreground-50)" }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

function SecuritySection() {
  const { t } = useTranslation();
  const [curPw, setCurPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [saving, setSaving] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!curPw) {
      toast.error(t("pages.settings.enterCurrentPassword"));
      return;
    }
    if (newPw.length < 8) {
      toast.error(t("pages.settings.passwordMin8"));
      return;
    }
    if (newPw !== confirmPw) {
      toast.error(t("authPages.registerPasswordMismatch"));
      return;
    }
    if (isDemoMode()) {
      toast(t("pages.settings.demoPasswordChange"));
      return;
    }

    setSaving(true);
    try {
      await changePassword(curPw, newPw);
      toast.success(t("pages.settings.passwordChanged"));
      setCurPw("");
      setNewPw("");
      setConfirmPw("");
    } catch (err) {
      if (err instanceof ApiError && err.status === 422) {
        const firstMessage = err.errors ? Object.values(err.errors)[0]?.[0] : undefined;
        toast.error(firstMessage ?? t("pages.settings.checkCurrentPassword"));
      } else {
        toast.error(t("pages.settings.passwordChangeFailed"));
      }
    } finally {
      setSaving(false);
    }
  };

  const logoutOthers = async () => {
    if (isDemoMode()) {
      toast(t("pages.settings.demoUnavailable"));
      return;
    }
    setLoggingOut(true);
    try {
      await logoutOtherDevices();
      toast.success(t("pages.settings.loggedOutOtherDevices"));
    } catch {
      toast.error(t("pages.settings.logoutOthersFailed"));
    } finally {
      setLoggingOut(false);
    }
  };

  return (
    <SettingsSectionShell title={t("pages.settings.securityTitle")}>
      <Card
        className="p-[20px]"
        style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
      >
        <h2 className="mb-[4px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("pages.settings.changePassword")}
        </h2>
        <p className="mb-[14px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.settings.changePasswordDesc")}
        </p>
        <form onSubmit={submitPassword} className="space-y-[12px]">
          <Field label={t("pages.settings.currentPassword")}>
            <PasswordInput
              value={curPw}
              onChange={(e) => setCurPw(e.target.value)}
              autoComplete="current-password"
            />
          </Field>
          <Field label={t("pages.settings.newPassword")}>
            <PasswordInput
              value={newPw}
              onChange={(e) => setNewPw(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Field label={t("pages.settings.confirmNewPassword")}>
            <PasswordInput
              value={confirmPw}
              onChange={(e) => setConfirmPw(e.target.value)}
              autoComplete="new-password"
            />
          </Field>
          <Button type="submit" disabled={saving} className="gap-[8px]">
            {saving && <Loader2 size={16} className="animate-spin" />}
            {t("pages.settings.changePasswordBtn")}
          </Button>
        </form>
      </Card>

      <Card
        className="p-[20px]"
        style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
      >
        <h2 className="mb-[4px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("pages.settings.sessionsTitle")}
        </h2>
        <p className="mb-[14px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
          {t("pages.settings.sessionsDesc")}
        </p>
        <Button
          variant="outline"
          onClick={logoutOthers}
          disabled={loggingOut}
          className="gap-[8px]"
        >
          {loggingOut ? <Loader2 size={16} className="animate-spin" /> : <LogOut size={16} />}
          {t("pages.settings.logoutOtherDevices")}
        </Button>
      </Card>

      <Card
        className="p-[20px]"
        style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}
      >
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("pages.settings.blockedUsersTitle")}
        </h2>
        <BlockedUsersSection />
      </Card>
    </SettingsSectionShell>
  );
}
