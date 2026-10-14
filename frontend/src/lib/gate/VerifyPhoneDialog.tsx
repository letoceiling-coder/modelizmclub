import { useEffect, useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PhoneInput, phoneButtonHint } from "@/components/ui/phone-input";
import { SmsCodeInput } from "@/components/ui/sms-code-input";
import { revealAndFocus } from "@/lib/ui/reveal-and-focus";
import { phoneE164 } from "@/lib/phone";
import { readSmsRefusal } from "@/lib/api/account";
import { setCurrentUser } from "@/lib/store";
import { usePhoneVerificationFlow } from "@/lib/hooks/usePhoneVerificationFlow";
import { GateDialogShell } from "./GateDialogShell";
import { formatCountdown, useResendCountdown } from "./useResendCountdown";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = "intro" | "phone" | "wait" | "code";

/** SMS / Mobile ID verification: number → push or code → done. */
export function VerifyPhoneDialog({ open, onOpenChange, onSuccess }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("intro");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState("");

  const resend = useResendCountdown();
  const полеНомера = useRef<HTMLInputElement | null>(null);

  const flow = usePhoneVerificationFlow({
    onVerified: (user) => {
      setCurrentUser(user);
      reset();
      onSuccess();
    },
  });

  const reset = () => {
    setStep("intro");
    setError(null);
    setCode("");
    flow.resetFlow();
    resend.clear();
  };

  const requestCode = async () => {
    const value = phoneE164(phone);
    if (busy || resend.blocked) return;
    if (!value) {
      revealAndFocus(полеНомера.current);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const data = await flow.send(value);
      resend.start(data.resend_after);
      setCode("");
      if (data.verification_mode === "mobile_id" && data.phase === "awaiting_push") {
        setStep("wait");
      } else {
        setStep("code");
      }
    } catch (err) {
      const { retryAfter } = readSmsRefusal(err);
      if (retryAfter > 0) resend.start(retryAfter);
      else setStep("phone");
      setError(err instanceof Error && err.message ? err.message : "Не удалось отправить код.");
    } finally {
      setBusy(false);
    }
  };

  const sendCode = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    void requestCode();
  };

  const verify = async (typed?: string) => {
    const entered = (typed ?? code).trim();
    if (entered.length !== flow.codeLength) {
      setError(`Код состоит из ${flow.codeLength} цифр.`);
      return;
    }
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      await flow.verify(phoneE164(phone) ?? phone.trim(), entered);
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Неверный код.");
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    if (flow.needsCodeInput && step === "wait") setStep("code");
  }, [flow.needsCodeInput, step]);

  return (
    <GateDialogShell
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
      title={t("gate.verify.title")}
      description={t("gate.verify.description")}
      icon={<Smartphone size={22} />}
    >
      {step === "intro" && (
        <Button type="button" size="lg" className="w-full" onClick={() => setStep("phone")}>
          {t("gate.verify.submit")}
        </Button>
      )}
      {step === "phone" && (
        <form onSubmit={sendCode} className="space-y-3">
          <PhoneInput
            hint
            hintId="verify-phone-hint"
            ref={полеНомера}
            value={phone}
            onValueChange={setPhone}
            required
            className="h-11"
          />
          {error && (
            <p className="text-[13px]" style={{ color: "var(--error)" }} role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={busy}
            disabled={busy || resend.blocked}
          >
            {resend.blocked
              ? `Повторить через ${formatCountdown(resend.left)}`
              : (phoneButtonHint(phone) ?? "Получить код")}
          </Button>
        </form>
      )}
      {step === "wait" && (
        <div className="space-y-3">
          <p className="text-[13px]" style={{ color: "var(--foreground-70)" }}>
            {flow.hint || "Подтвердите уведомление на телефоне или дождитесь SMS."}
          </p>
          <div
            className="flex items-center justify-center gap-2 py-4 text-[14px]"
            style={{ color: "var(--foreground-50)" }}
          >
            <Loader2 size={18} className="animate-spin" aria-hidden />
            Ожидаем подтверждение…
          </div>
          <button type="button" className="text-[13px] underline" onClick={() => setStep("phone")}>
            Изменить номер
          </button>
        </div>
      )}
      {step === "code" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            void verify();
          }}
          className="space-y-3"
        >
          <p className="text-[13px]" style={{ color: "var(--foreground-70)" }}>
            {flow.hint || `Код из ${flow.codeLength} цифр отправлен на ${phone}.`}{" "}
            <button type="button" className="underline" onClick={() => setStep("phone")}>
              Изменить номер
            </button>
          </p>
          <SmsCodeInput
            name="code"
            length={flow.codeLength}
            value={code}
            onValueChange={setCode}
            onComplete={(digits) => void verify(digits)}
            aria-label={`Код из ${flow.codeLength} цифр`}
            required
            className="h-11"
          />
          {error && (
            <p className="text-[13px]" style={{ color: "var(--error)" }} role="alert">
              {error}
            </p>
          )}
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={busy}
            disabled={busy || code.length !== flow.codeLength}
          >
            Подтвердить
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="w-full"
            disabled={busy || resend.blocked}
            onClick={() => void requestCode()}
          >
            {resend.blocked
              ? `Отправить снова через ${formatCountdown(resend.left)}`
              : "Отправить код ещё раз"}
          </Button>
        </form>
      )}
    </GateDialogShell>
  );
}
