import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { sendPhoneVerificationCode, verifyPhoneCode } from "@/lib/api/account";
import { setCurrentUser } from "@/lib/store";
import { GateDialogShell } from "./GateDialogShell";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess: () => void;
}

type Step = "intro" | "phone" | "code";

/** SMS verification inside the window: number → code → done. */
export function VerifyPhoneDialog({ open, onOpenChange, onSuccess }: Props) {
  const { t } = useTranslation();
  const [step, setStep] = useState<Step>("intro");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setStep("intro");
    setError(null);
  };

  const sendCode = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const value = phone.trim();
    if (!value) return;
    setBusy(true);
    setError(null);
    try {
      await sendPhoneVerificationCode(value);
      setStep("code");
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Не удалось отправить код.");
    } finally {
      setBusy(false);
    }
  };

  const verify = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const code = String(new FormData(e.currentTarget).get("code") ?? "").trim();
    if (!code) return;
    setBusy(true);
    setError(null);
    try {
      const user = await verifyPhoneCode(phone.trim(), code);
      setCurrentUser(user);
      reset();
      onSuccess();
    } catch (err) {
      setError(err instanceof Error && err.message ? err.message : "Неверный код.");
    } finally {
      setBusy(false);
    }
  };

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
          <Input
            type="tel"
            autoComplete="tel"
            inputMode="tel"
            placeholder="+7 900 000-00-00"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
            className="h-11"
          />
          {error && (
            <p className="text-[13px]" style={{ color: "var(--error)" }} role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Получить код
          </Button>
        </form>
      )}
      {step === "code" && (
        <form onSubmit={verify} className="space-y-3">
          <p className="text-[13px]" style={{ color: "var(--foreground-70)" }}>
            Код отправлен на {phone}.{" "}
            <button type="button" className="underline" onClick={() => setStep("phone")}>
              Изменить номер
            </button>
          </p>
          <Input
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            placeholder="Код из SMS"
            required
            className="h-11"
          />
          {error && (
            <p className="text-[13px]" style={{ color: "var(--error)" }} role="alert">
              {error}
            </p>
          )}
          <Button type="submit" size="lg" className="w-full" loading={busy}>
            Подтвердить
          </Button>
        </form>
      )}
    </GateDialogShell>
  );
}
