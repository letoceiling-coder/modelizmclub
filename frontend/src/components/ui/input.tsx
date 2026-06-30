import * as React from "react";

import { cn } from "@/lib/utils";

export interface InputProps extends React.ComponentProps<"input"> {
  /** Marks the field as invalid — applies the UI Kit error border/ring. */
  error?: boolean;
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type, error, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-[var(--r-input)] border bg-[var(--background-input)] px-3 py-1 text-base text-[var(--foreground)] shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-[var(--foreground)] placeholder:text-[var(--neutral-400)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
          error
            ? "border-[var(--danger)] focus-visible:ring-[var(--danger-soft)] focus-visible:border-[var(--danger)]"
            : "border-[var(--border)] focus-visible:ring-[var(--accent-soft)] focus-visible:border-[var(--accent)]",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
