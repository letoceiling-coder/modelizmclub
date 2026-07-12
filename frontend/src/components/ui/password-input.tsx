import * as React from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input, type InputProps } from "./input";
import { cn } from "@/lib/utils";

/** `Input` with a show/hide toggle ("глазик") — same UI Kit styling, just password-specific. */
const PasswordInput = React.forwardRef<HTMLInputElement, Omit<InputProps, "type">>(
  ({ className, ...props }, ref) => {
    const [visible, setVisible] = React.useState(false);
    return (
      <div className="relative">
        <Input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={visible ? "Скрыть пароль" : "Показать пароль"}
          className="absolute right-[10px] top-1/2 grid h-[28px] w-[28px] -translate-y-1/2 place-items-center rounded-full transition-colors"
          style={{ color: "var(--foreground-50)" }}
        >
          {visible ? <EyeOff size={16} /> : <Eye size={16} />}
        </button>
      </div>
    );
  },
);
PasswordInput.displayName = "PasswordInput";

export { PasswordInput };
