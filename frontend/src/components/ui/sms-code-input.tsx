import * as React from "react";
import { Input, type InputProps } from "./input";
import { smsCodeLength } from "@/lib/api/bootstrap";

export interface SmsCodeInputProps extends Omit<InputProps, "type" | "value" | "onChange"> {
  value: string;
  /** Получает уже очищенные цифры, не событие: вызывающему нечего разбирать. */
  onValueChange: (digits: string) => void;
  /**
   * Сколько цифр ждём. Приходит из ответа сервера на запрос кода
   * (решение З1); без него — значение из общей загрузки.
   */
  length?: number;
  /** Вызывается, когда набрана последняя цифра: отправка без нажатия кнопки. */
  onComplete?: (digits: string) => void;
}

/**
 * Поле кода из SMS.
 *
 * Одно место на весь сайт — до 09.10 это поле было написано заново в трёх
 * файлах (`settings.account.tsx` дважды, `ads.new.tsx`, `VerifyPhoneDialog`),
 * и каждое держало свою шестёрку в `maxLength`, в `slice(0, 6)` и в условии
 * доступности кнопки. Девять независимых записей одного числа.
 *
 * Что здесь есть, кроме длины:
 *
 * - `inputMode="numeric"` — цифровая клавиатура на телефоне;
 * - `autoComplete="one-time-code"` — iOS и Android предлагают код из
 *   пришедшей SMS прямо над клавиатурой, а Chrome на Android подставляет его
 *   сам через WebOTP; без этого атрибута ни то, ни другое не работает;
 * - вставка целиком — `onPaste` чистит пробелы и буквы, потому что из
 *   уведомления код копируется вместе с текстом «Modelizm: код подтверждения»;
 * - `onComplete` — когда набрана последняя цифра, отправляем сами: лишнее
 *   нажатие на телефоне стоит дороже, чем кажется.
 *
 * Чего здесь нет намеренно: разбивки на отдельные клетки. Клетки ломают и
 * автоподстановку, и вставку, и диктора — а выигрывают только в красоте.
 */
const SmsCodeInput = React.forwardRef<HTMLInputElement, SmsCodeInputProps>(
  ({ value, onValueChange, length, onComplete, ...props }, ref) => {
    const size = length ?? smsCodeLength();

    const push = (raw: string) => {
      const digits = raw.replace(/\D/g, "").slice(0, size);
      onValueChange(digits);
      if (digits.length === size) onComplete?.(digits);
    };

    return (
      <Input
        {...props}
        ref={ref}
        type="text"
        inputMode="numeric"
        autoComplete="one-time-code"
        maxLength={size}
        placeholder={"0".repeat(size)}
        value={value}
        onChange={(e) => push(e.target.value)}
        onPaste={(e) => {
          const pasted = e.clipboardData.getData("text");
          if (!/\d/.test(pasted)) return;
          e.preventDefault();
          push(pasted);
        }}
      />
    );
  },
);
SmsCodeInput.displayName = "SmsCodeInput";

export { SmsCodeInput };
