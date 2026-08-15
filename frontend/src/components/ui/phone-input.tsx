import * as React from "react";
import { Input, type InputProps } from "./input";

/** Formats digits-as-typed into +7 (999) 999-99-99. No external mask library. */
function formatRuPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (digits.length > 0 && !digits.startsWith("7")) digits = "7" + digits;
  digits = digits.slice(0, 11);

  const rest = digits.slice(1);
  let out = "+7";
  if (rest.length > 0) out += ` (${rest.slice(0, 3)}`;
  if (rest.length >= 3) out += ")";
  if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
  if (rest.length > 6) out += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) out += `-${rest.slice(8, 10)}`;
  return out;
}

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

/** Phone input with a Russian-format mask (+7 (999) 999-99-99), formatted as you type. */
const PhoneInput = React.forwardRef<
  HTMLInputElement,
  Omit<InputProps, "type" | "onChange" | "value" | "defaultValue"> & {
    value?: string;
    defaultValue?: string;
    onValueChange?: (formatted: string) => void;
  }
>(({ value: valueProp, defaultValue, onValueChange, ...props }, ref) => {
  const isControlled = valueProp !== undefined;
  const [internalValue, setInternalValue] = React.useState(() =>
    valueProp !== undefined
      ? formatRuPhone(String(valueProp))
      : defaultValue
        ? formatRuPhone(String(defaultValue))
        : "",
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
      if (prev.replace(/\D/g, "") === formatted.replace(/\D/g, "")) return prev;
      return formatted;
    });
  }, [defaultValue, isControlled]);

  const commitValue = (formatted: string, cursorDigitIndex?: number) => {
    if (!isControlled) setInternalValue(formatted);
    onValueChange?.(formatted);

    if (cursorDigitIndex !== undefined && inputRef.current) {
      const el = inputRef.current;
      const pos = cursorAfterDigits(formatted, cursorDigitIndex);
      requestAnimationFrame(() => {
        el.setSelectionRange(pos, pos);
      });
    }
  };

  return (
    <Input
      {...props}
      ref={inputRef}
      type="tel"
      inputMode="tel"
      autoComplete="tel"
      value={displayValue}
      placeholder={props.placeholder ?? "+7 (___) ___-__-__"}
      onChange={(e) => {
        const raw = e.target.value;
        const cursor = e.target.selectionStart ?? raw.length;
        const digitIndex = countDigitsBefore(raw, cursor);
        const formatted = formatRuPhone(raw);
        commitValue(formatted, digitIndex);
      }}
      onFocus={(e) => {
        focusedRef.current = true;
        props.onFocus?.(e);
      }}
      onBlur={(e) => {
        focusedRef.current = false;
        props.onBlur?.(e);
      }}
    />
  );
});
PhoneInput.displayName = "PhoneInput";

export { PhoneInput, formatRuPhone };
