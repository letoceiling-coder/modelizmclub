import * as React from "react";

import { cn } from "@/lib/utils";

export interface TextareaProps extends React.ComponentProps<"textarea"> {
  /** Marks the field as invalid — applies the UI Kit error border/ring. */
  error?: boolean;
}

const Textarea = React.forwardRef<HTMLTextAreaElement, TextareaProps>(
  ({ className, error, ...props }, ref) => {
    return (
      <textarea
        className={cn(
          "flex min-h-[100px] w-full rounded-[var(--r-input)] border bg-[var(--background-input)] px-3 py-2 text-base text-[var(--foreground)] shadow-sm placeholder:text-[var(--neutral-400)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-0 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm",
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
Textarea.displayName = "Textarea";

export { Textarea };
