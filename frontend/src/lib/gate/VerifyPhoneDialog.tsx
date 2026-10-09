import { useRef, useState, type FormEvent } from "react";
import { useTranslation } from "react-i18next";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PhoneInput, phoneButtonHint } from "@/components/ui/phone-input";
import { revealAndFocus } from "@/lib/ui/reveal-and-focus";
import { phoneE164 } from "@/lib/phone";
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
  const полеНомера = useRef<HTMLInputElement | null>(null);

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
    /*
     * На сервер уходит `+7` и десять цифр, а не то, что человек набрал.
     *
     * До 09.10 здесь стоял обычный `<input type="tel">`, и `phone.trim()`
     * отправлялся как есть: «89384100024», «8 938 410 00 24», «+7 938…» —
     * сервер приводил их сам, а те, что привести нельзя, отвечали
     * «Укажите корректный номер телефона». Теперь номер приводится полем по
     * тому же правилу, что на сервере (`@/lib/phone`).
     */
    const value = phoneE164(phone);
    if (busy || resend.blocked) return;
    if (!value) {
      /* Номер неполон. Кнопка об этом уже написана подписью, но нажатие
         должно что-то делать: ставим курсор в поле, как в форме регистрации
         по решению Ж1. */
      revealAndFocus(полеНомера.current);
      return;
    }
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
      const user = await verifyPhoneCode(phoneE164(phone) ?? phone.trim(), code);
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
          {/*
            Кнопка нажимаема, пока номер неполон, и говорит, чего не хватает.
            Серая кнопка без объяснения — то же, на что владелец жаловался в
            форме регистрации (решение Ж1): человек видит запрет и не видит
            причины. Отсчёт повторной отправки — другое дело: там названы и
            причина, и срок.
          */}
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
