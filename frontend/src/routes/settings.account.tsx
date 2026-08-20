import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "@/lib/toast";
import { ChevronRight, Loader2 } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput } from "@/components/ui/phone-input";
import { Badge } from "@/components/ui/badge";
import { useStore, selectors, setCurrentUser } from "@/lib/store";
import { isDemoMode } from "@/lib/demo-mode";
import { fetchMe } from "@/lib/api/auth";
import { requestEmailChange, resendVerificationEmail, sendPhoneVerificationCode, verifyPhoneCode } from "@/lib/api/account";
import { displayEmail, isFullyVerified, isVkOAuthUser } from "@/lib/auth/verification";
import { verificationSummary } from "@/lib/access/accessTier";
import { ApiError } from "@/lib/api/client";

export const Route = createFileRoute("/settings/account")({
  validateSearch: (s: Record<string, unknown>): { redirect?: string } => ({
    redirect: typeof s.redirect === "string" && s.redirect.startsWith("/") ? s.redirect : undefined,
  }),
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
  const { t } = useTranslation();
  const { redirect: afterVerify } = Route.useSearch();
  const currentUser = useStore(selectors.currentUser);
  const [loading, setLoading] = useState(!isDemoMode());
  const [accountEmail, setAccountEmail] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [verifiedPhone, setVerifiedPhone] = useState<string | null>(null);
  const [serverEmailVerified, setServerEmailVerified] = useState<boolean | null>(null);
  const [serverPhoneVerified, setServerPhoneVerified] = useState<boolean | null>(null);
  const [verifySent, setVerifySent] = useState(false);
  const [smsCode, setSmsCode] = useState("");
  const [smsSending, setSmsSending] = useState(false);
  const [smsVerifying, setSmsVerifying] = useState(false);
  const [smsSent, setSmsSent] = useState(false);
  const [smsCooldown, setSmsCooldown] = useState(0);

  useEffect(() => {
    if (smsCooldown <= 0) return;
    const timer = window.setInterval(() => setSmsCooldown((s) => Math.max(0, s - 1)), 1000);
    return () => window.clearInterval(timer);
  }, [smsCooldown]);

  useEffect(() => {
    if (isDemoMode()) {
      setAccountEmail(currentUser?.email ?? "");
      setPhone(currentUser?.phone ?? "");
      setServerEmailVerified(currentUser?.email_verified ?? null);
      setServerPhoneVerified(currentUser?.phone_verified ?? null);
      setVerifiedPhone(currentUser?.phone ?? null);
      setLoading(false);
      return;
    }
    fetchMe().then((u) => {
      if (!u) return;
      setCurrentUser(u);
      setAccountEmail(displayEmail(u) ?? "");
      setPhone(u.phone ?? "");
      setVerifiedPhone(u.phone_verified ? (u.phone ?? null) : null);
      setServerEmailVerified(u.email_verified === true);
      setServerPhoneVerified(u.phone_verified === true);
    }).catch(() => {
      toast.error(t("pages.settings.loadFailed"));
    }).finally(() => setLoading(false));
  }, [currentUser?.email, currentUser?.phone, currentUser?.email_verified, currentUser?.phone_verified, t]);

  useEffect(() => {
    if (loading || serverPhoneVerified === true) return;
    document.getElementById("sms-verify")?.scrollIntoView({ block: "start" });
  }, [loading, serverPhoneVerified]);

  const phoneMatchesVerified =
    serverPhoneVerified === true &&
    verifiedPhone !== null &&
    phone.replace(/\D/g, "") === verifiedPhone.replace(/\D/g, "");

  useEffect(() => {
    if (loading || phoneMatchesVerified) return;
    document.getElementById("sms-verify")?.scrollIntoView({ block: "start" });
  }, [loading, phoneMatchesVerified]);

  const submitEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(newEmail)) {
      toast.error(t("pages.settings.invalidEmail"));
      return;
    }
    if (isDemoMode()) {
      setAccountEmail(newEmail);
      setServerEmailVerified(false);
      setNewEmail("");
      toast.success(t("pages.settings.emailUpdated"));
      return;
    }
    try {
      await requestEmailChange(newEmail);
      setAccountEmail(newEmail);
      setServerEmailVerified(false);
      setNewEmail("");
      setVerifySent(false);
      toast.success(t("pages.settings.emailUpdated"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("pages.settings.emailChangeFailed"));
    }
  };

  const resendVerification = async () => {
    if (isDemoMode()) { setVerifySent(true); return; }
    try {
      await resendVerificationEmail();
      setVerifySent(true);
    } catch {
      toast.error(t("pages.settings.emailSendFailed"));
    }
  };

  const sendSms = async () => {
    const normalized = phone.trim();
    if (!normalized || normalized.replace(/\D/g, "").length < 10) {
      toast.error(t("pages.settings.invalidPhone"));
      return;
    }
    setSmsSending(true);
    try {
      await sendPhoneVerificationCode(normalized);
      setSmsSent(true);
      setSmsCooldown(60);
      toast.success(t("pages.settings.smsSent"));
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("pages.settings.smsSendFailed"));
    } finally {
      setSmsSending(false);
    }
  };

  const confirmSms = async () => {
    const normalized = phone.trim();
    if (!normalized) return;
    if (!/^\d{6}$/.test(smsCode.trim())) {
      toast.error(t("pages.settings.invalidSmsCode"));
      return;
    }
    setSmsVerifying(true);
    try {
      const user = await verifyPhoneCode(normalized, smsCode.trim());
      setCurrentUser(user);
      setVerifiedPhone(user.phone ?? normalized);
      setServerPhoneVerified(user.phone_verified === true);
      setSmsCode("");
      setSmsSent(false);
      toast.success(t("pages.settings.phoneVerified"));
      if (afterVerify && afterVerify.startsWith("/") && !afterVerify.startsWith("//")) {
        window.location.assign(afterVerify);
      }
    } catch (err) {
      toast.error(err instanceof ApiError ? err.message : t("pages.settings.wrongCode"));
    } finally {
      setSmsVerifying(false);
    }
  };

  const onPhoneChange = (v: string) => {
    setPhone(v);
    if (verifiedPhone && v.replace(/\D/g, "") !== verifiedPhone.replace(/\D/g, "")) {
      setServerPhoneVerified(false);
      setSmsSent(false);
      setSmsCode("");
    }
  };

  const vkOAuth = isVkOAuthUser(currentUser);
  const summary = verificationSummary(currentUser);
  const accountVerified = isFullyVerified(currentUser);

  if (loading) {
    return (
      <SettingsSectionShell title={t("pages.settings.accountTitle")}>
        <div className="flex items-center gap-[8px] py-[24px] text-[14px]" style={{ color: "var(--foreground-50)" }}>
          <Loader2 size={16} className="animate-spin" /> {t("pages.settings.loading")}
        </div>
      </SettingsSectionShell>
    );
  }

  return (
    <SettingsSectionShell title={t("pages.settings.accountTitle")}>
      <Link
        to="/profile"
        className="flex items-center gap-[12px] rounded-[12px] border px-[16px] py-[14px] transition-colors hover:bg-[var(--background-surface)]"
        style={{ borderColor: "var(--border)" }}
      >
        <div className="min-w-0 flex-1">
          <div className="text-[15px] font-medium" style={{ color: "var(--foreground)" }}>{t("pages.settings.publicProfile")}</div>
          <div className="text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("pages.settings.publicProfileDesc")}</div>
        </div>
        <ChevronRight size={18} style={{ color: "var(--foreground-30)" }} />
      </Link>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <h2 className="mb-[10px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("pages.settings.verificationSummaryTitle")}
        </h2>
        <div className="flex flex-wrap gap-[8px]">
          <Badge variant={summary.emailOk ? "published" : "draft"} withIcon={false}>
            {t("pages.settings.emailLabel")}: {summary.emailOk ? t("pages.settings.verified") : t("pages.settings.notVerified")}
          </Badge>
          {summary.phoneRequired && (
            <Badge variant={summary.phoneOk ? "published" : "draft"} withIcon={false}>
              {t("pages.settings.phone")}: {summary.phoneOk ? t("pages.settings.phoneVerifiedSms") : t("pages.settings.notVerified")}
            </Badge>
          )}
          {accountVerified && (
            <Badge variant="published" withIcon={false}>{t("pages.settings.accountReady")}</Badge>
          )}
        </div>
        {!accountVerified && (
          <p className="mt-[10px] text-[13px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>
            {t("pages.settings.verificationSummaryHint")}
          </p>
        )}
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <h2 className="mb-[6px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>{t("pages.settings.emailLabel")}</h2>
        {vkOAuth && !accountEmail ? (
          <p className="text-[14px]" style={{ color: "var(--foreground-70)" }}>
            Вы вошли через VK ID. Подтверждение email не требуется — при необходимости добавьте почту в блоке ниже.
          </p>
        ) : accountEmail ? (
          <>
            <div className="flex flex-wrap items-center gap-[8px]">
              <p className="text-[14px]" style={{ color: "var(--foreground)" }}>{accountEmail}</p>
              {serverEmailVerified === true && (
                <Badge variant="published" withIcon={false}>{t("pages.settings.verified")}</Badge>
              )}
              {serverEmailVerified === false && !vkOAuth && (
                <Badge variant="draft" withIcon={false}>{t("pages.settings.notVerified")}</Badge>
              )}
            </div>
            {serverEmailVerified === false && !vkOAuth && (
              verifySent ? (
                <p className="mt-[12px] text-[13px]" style={{ color: "var(--foreground-70)" }}>
                  {t("pages.settings.verificationSentTo", { email: accountEmail })}
                </p>
              ) : (
                <Button type="button" variant="outline" size="sm" onClick={resendVerification} className="mt-[12px]">
                  {t("pages.settings.resendVerificationBtn")}
                </Button>
              )
            )}
          </>
        ) : (
          <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>{t("pages.settings.emailMissing")}</p>
        )}
      </Card>

      <Card className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <h2 className="mb-[14px] text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>{t("pages.settings.changeEmail")}</h2>
        <form onSubmit={submitEmail} className="space-y-[12px]">
          <Field label={t("pages.settings.newEmail")}>
            <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="you@example.com" autoComplete="email" />
          </Field>
          <Button type="submit">{t("pages.settings.changeEmailBtn")}</Button>
        </form>
      </Card>

      <Card id="sms-verify" className="p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
        <div className="mb-[14px] flex flex-wrap items-center gap-[8px]">
          <h2 className="text-[16px] font-semibold" style={{ color: "var(--foreground)" }}>{t("pages.settings.phone")}</h2>
          {phoneMatchesVerified ? (
            <Badge variant="published" withIcon={false}>{t("pages.settings.phoneVerifiedSms")}</Badge>
          ) : (
            <Badge variant="draft" withIcon={false}>{t("pages.settings.notVerified")}</Badge>
          )}
        </div>
        <Field label={t("pages.settings.phoneNumber")}>
          <PhoneInput value={phone} onValueChange={onPhoneChange} />
        </Field>

        {!phoneMatchesVerified && (
          <div className="mt-[12px] space-y-[12px]">
            <Button
              type="button"
              variant="outline"
              onClick={sendSms}
              disabled={smsSending || smsCooldown > 0}
            >
              {smsSending
                ? t("pages.settings.sending")
                : smsCooldown > 0
                  ? t("pages.settings.resendIn", { sec: smsCooldown })
                  : smsSent
                    ? t("pages.settings.resendSms")
                    : t("pages.settings.sendSms")}
            </Button>

            {smsSent && (
              <div className="flex flex-col gap-[8px] sm:flex-row sm:items-end">
                <Field label={t("pages.settings.smsCode")}>
                  <Input
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={6}
                    value={smsCode}
                    onChange={(e) => setSmsCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                    placeholder="000000"
                  />
                </Field>
                <Button type="button" onClick={confirmSms} disabled={smsVerifying || smsCode.length !== 6}>
                  {smsVerifying ? t("pages.settings.verifying") : t("pages.settings.confirm")}
                </Button>
              </div>
            )}
          </div>
        )}

        <p className="mt-[12px] text-[12px] leading-relaxed" style={{ color: "var(--foreground-50)" }}>
          {t("pages.settings.phoneConfirmNote")}
        </p>
      </Card>
    </SettingsSectionShell>
  );
}
