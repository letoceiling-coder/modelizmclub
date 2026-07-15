import * as React from "react";
import { Input, type InputProps } from "./input";

/** Groups digits into 0000 0000 0000 0000, capped at 16 digits. No external mask library. */
function formatCardNumber(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 16);
  return (digits.match(/.{1,4}/g) ?? []).join(" ");
}

/** Bank card number input, formatted as you type. Fully controlled — pass
 *  digits-only `value` and receive digits-only updates via `onValueChange`. */
const CardNumberInput = React.forwardRef<
  HTMLInputElement,
  Omit<InputProps, "type" | "value" | "onChange"> & { value: string; onValueChange: (digits: string) => void }
>(({ value, onValueChange, ...props }, ref) => (
  <Input
    {...props}
    ref={ref}
    type="text"
    inputMode="numeric"
    autoComplete="off"
    value={formatCardNumber(value)}
    placeholder={props.placeholder ?? "0000 0000 0000 0000"}
    onChange={(e) => onValueChange(e.target.value.replace(/\D/g, "").slice(0, 16))}
  />
));
CardNumberInput.displayName = "CardNumberInput";

export { CardNumberInput, formatCardNumber };
