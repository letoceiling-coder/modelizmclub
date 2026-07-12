import * as React from "react";
import { Input, type InputProps } from "./input";

/** Formats digits-as-typed into +7 (999) 999-99-99. No external mask library. */
function formatRuPhone(raw: string): string {
  let digits = raw.replace(/\D/g, "");
  if (digits.startsWith("8")) digits = "7" + digits.slice(1);
  if (!digits.startsWith("7")) digits = "7" + digits;
  digits = digits.slice(0, 11);

  const rest = digits.slice(1); // after leading 7
  let out = "+7";
  if (rest.length > 0) out += ` (${rest.slice(0, 3)}`;
  if (rest.length >= 3) out += ")";
  if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
  if (rest.length > 6) out += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) out += `-${rest.slice(8, 10)}`;
  return out;
}

/** Phone input with a Russian-format mask (+7 (999) 999-99-99), formatted as you type. */
const PhoneInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type" | "onChange"> & { onValueChange?: (formatted: string) => void }>(
  ({ defaultValue, onValueChange, ...props }, ref) => {
    const [value, setValue] = React.useState(() => (defaultValue ? formatRuPhone(String(defaultValue)) : ""));
    return (
      <Input
        {...props}
        ref={ref}
        type="tel"
        inputMode="tel"
        value={value}
        placeholder={props.placeholder ?? "+7 (___) ___-__-__"}
        onChange={(e) => {
          const formatted = formatRuPhone(e.target.value);
          setValue(formatted);
          onValueChange?.(formatted);
        }}
        onFocus={(e) => {
          if (!value) setValue("+7 ");
          props.onFocus?.(e);
        }}
      />
    );
  },
);
PhoneInput.displayName = "PhoneInput";

export { PhoneInput, formatRuPhone };
