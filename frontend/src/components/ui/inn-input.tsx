import * as React from "react";
import { Input, type InputProps } from "./input";

/** ИНН — digits only, capped at 12 (10 for юрлиц, 12 for физлиц/ИП). No
 *  grouping separators in the standard format, so the mask is length +
 *  charset only. Behaves like a plain Input's onChange, just pre-cleaned. */
const InnInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type">>(
  ({ onChange, ...props }, ref) => (
    <Input
      {...props}
      ref={ref}
      type="text"
      inputMode="numeric"
      maxLength={12}
      onChange={(e) => {
        const digits = e.target.value.replace(/\D/g, "").slice(0, 12);
        if (digits !== e.target.value) e.target.value = digits;
        onChange?.(e);
      }}
    />
  ),
);
InnInput.displayName = "InnInput";

export { InnInput };
