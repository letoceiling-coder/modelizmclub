import { useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { readSmsRefusal, sendPhoneVerificationCode, verifyPhoneCode } from "@/lib/api/account";
import { setCurrentUser } from "@/lib/store";
import { GateDialogShell } from "./GateDialogShell";
import { formatCountdown, useResendCountdown } from "./useResendCountdown";

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

  const resend = useResendCountdown();

  const reset = () => {
    setStep("intro");
    setError(null);
    resend.clear();
  };

  /**
   * Одна отправка на все случаи: первая и повторная.
   *
   * Раньше повторить можно было только через «Изменить номер» — обратно на шаг
   * ввода, где кнопка ничем не блокировалась. Человек жал её сразу и получал
   * отказ, а на четвёртый раз выбирал предел на десять минут. Теперь после
   * успешной отправки кнопка блокируется на паузу, которую назвал сервер, а
   * при отказе — на срок из ответа.
   */
  const requestCode = async () => {
    const value = phone.trim();
    if (!value || busy || resend.blocked) return;
    setBusy(true);
    setError(null);
    try {
      const { resend_after } = await sendPhoneVerificationCode(value);
      resend.start(resend_after);
      setStep("code");
    } catch (err) {
      const { retryAfter } = readSmsRefusal(err);
      // Отказ оператора приходит без срока: там ждать нечего, надо править
      // номер, поэтому кнопку не блокируем и возвращаем на шаг ввода.
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
          <Button
            type="submit"
            size="lg"
            className="w-full"
            loading={busy}
            disabled={busy || resend.blocked}
          >
            {resend.blocked ? `Повторить через ${formatCountdown(resend.left)}` : "Получить код"}
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
          {/*
            Повтор здесь, а не через возврат к вводу номера: до отсчёта было
            видно только «Изменить номер», и человек уходил туда просто чтобы
            нажать «Получить код» ещё раз.
          */}
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
