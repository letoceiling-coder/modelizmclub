import * as React from "react";
import { Input, type InputProps } from "./input";
import { formatRuPhone, PHONE_DIGITS, phoneDigits, phoneDigitsLeft } from "@/lib/phone";
import { склонение } from "@/lib/format/plural";

function countDigitsBefore(value: string, cursor: number): number {
  return value.slice(0, cursor).replace(/\D/g, "").length;
}

function cursorAfterDigits(formatted: string, digitCount: number): number {
  if (digitCount <= 0) return formatted.startsWith("+7") ? 3 : 0;
  let seen = 0;
  for (let i = 0; i < formatted.length; i++) {
    if (/\d/.test(formatted[i])) {
      seen++;
      if (seen >= digitCount) return i + 1;
    }
  }
  return formatted.length;
}

/** Подсказка под полем: сколько цифр ждут. Решение Ж2, пункт 5. */
export const PHONE_HINT = `Введите ${PHONE_DIGITS} цифр номера`;

/**
 * Чего не хватает кнопке, чтобы её нажали, — словами.
 *
 * Решение Ж2, пункт 5: «Пока цифр меньше десяти — кнопка „Получить код“
 * объясняет, чего не хватает». Не «кнопка серая», а именно объясняет: то же
 * правило, что в решении Ж1 про кнопку регистрации.
 */
export function phoneButtonHint(raw: string): string | null {
  const left = phoneDigitsLeft(raw);
  if (left <= 0) return null;
  if (left === PHONE_DIGITS) return PHONE_HINT;
  return `Введите ещё ${left} ${склонение(left, "цифру", "цифры", "цифр")}`;
}

/**
 * Поле телефона: постоянная приставка +7 и десять цифр (решение Ж2).
 *
 * Правило приведения номера живёт в `@/lib/phone` и общее с сервером; здесь
 * только поле: приставка, маска, курсор и подсказка.
 *
 * **Приставка видна всегда, даже в пустом поле.** До 09.10 пустое поле было
 * пустым, и «+7» появлялось лишь после первой цифры: человек не знал, с чего
 * начинать, и набирал номер то с восьмёрки, то со своего +7. А в окне
 * подтверждения номера — том самом, со снимка владельца, — поле было вовсе
 * обычным `<input type="tel">`, и на сервер уходило ровно набранное.
 */
const PhoneInput = React.forwardRef<
  HTMLInputElement,
  Omit<InputProps, "type" | "onChange" | "value" | "defaultValue"> & {
    value?: string;
    defaultValue?: string;
    onValueChange?: (formatted: string) => void;
    /** Показать под полем подсказку «Введите 10 цифр номера». */
    hint?: boolean;
    /** `id` подсказки — уходит в `aria-describedby` поля. */
    hintId?: string;
  }
>(({ value: valueProp, defaultValue, onValueChange, hint, hintId, ...props }, ref) => {
  const isControlled = valueProp !== undefined;
  const [internalValue, setInternalValue] = React.useState(() =>
    formatRuPhone(String(valueProp ?? defaultValue ?? "")),
  );
  const focusedRef = React.useRef(false);
  const inputRef = React.useRef<HTMLInputElement>(null);

  React.useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  const displayValue = isControlled ? formatRuPhone(String(valueProp ?? "")) : internalValue;

  React.useEffect(() => {
    if (isControlled || focusedRef.current) return;
    if (defaultValue == null || String(defaultValue).trim() === "") return;
    const formatted = formatRuPhone(String(defaultValue));
    setInternalValue((prev) => {
      if (phoneDigits(prev) === phoneDigits(formatted)) return prev;
      return formatted;
    });
  }, [defaultValue, isControlled]);

  const commitValue = (formatted: string, cursorDigitIndex?: number) => {
    if (!isControlled) setInternalValue(formatted);
    onValueChange?.(formatted);

    if (cursorDigitIndex !== undefined && inputRef.current) {
      const el = inputRef.current;
      const pos = cursorAfterDigits(formatted, cursorDigitIndex);
      /*
       * Курсор ставится после отрисовки, иначе маска отбрасывает его в конец
       * при стирании в середине. `requestAnimationFrame` здесь уместен: это
       * рабочий код в видимой вкладке, а не замер (CLAUDE.md, «скрытая
       * вкладка останавливает наблюдателей» — про замеры).
       */
      requestAnimationFrame(() => {
        el.setSelectionRange(pos, pos);
      });
    }
  };

  const поле = (
    <Input
      {...props}
      ref={inputRef}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={displayValue}
      aria-describedby={hint && hintId ? hintId : props["aria-describedby"]}
      placeholder={props.placeholder ?? "+7 (___) ___-__-__"}
      onChange={(e) => {
        const raw = e.target.value;
        const cursor = e.target.selectionStart ?? raw.length;
        /*
         * Приставка не стирается: `formatRuPhone("")` возвращает «+7», и
         * человек, выделивший всё и нажавший Delete, получает приставку, а не
         * пустое поле. Цифры до курсора считаются по сырому значению — так
         * курсор не прыгает при стирании в середине (пункт 4 решения).
         */
        const digitIndex = countDigitsBefore(raw, cursor);
        commitValue(formatRuPhone(raw), digitIndex);
      }}
      onFocus={(e) => {
        focusedRef.current = true;
        /* Приставка появляется при входе в пустое поле, чтобы сразу было
           видно: ждут десять цифр, а не номер целиком. */
        if (phoneDigits(displayValue).length === 0 && displayValue !== "+7") {
          commitValue("+7");
        }
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        props.onBlur?.(e);
      }}
    />
  );

  if (!hint) return поле;

  return (
    <div>
      {поле}
      <p
        id={hintId}
        className="mt-[6px] text-[12px] leading-[16px]"
        style={{ color: "var(--foreground-50)" }}
      >
        {PHONE_HINT}
      </p>
    </div>
  );
});
PhoneInput.displayName = "PhoneInput";

export { PhoneInput, formatRuPhone };
