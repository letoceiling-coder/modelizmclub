import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { CheckCircle2, Info, XCircle, AlertTriangle } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

// UI Kit 2.0 — left state stripe + icon + title + text, airy card style.
const alertVariants = cva(
  "relative flex w-full gap-3 overflow-hidden rounded-[var(--r-card-sm)] border bg-[var(--background-elevated)] py-3 pl-4 pr-4 text-sm shadow-[var(--shadow-card)] before:absolute before:inset-y-0 before:left-0 before:w-1 before:content-['']",
  {
    variants: {
      variant: {
        success: "border-[var(--success-soft)] text-[var(--foreground)] before:bg-[var(--success)]",
        info: "border-[var(--info-soft)] text-[var(--foreground)] before:bg-[var(--info)]",
        error: "border-[var(--danger-soft)] text-[var(--foreground)] before:bg-[var(--danger)]",
        warning: "border-[var(--warning-soft)] text-[var(--foreground)] before:bg-[var(--warning)]",
        default: "border-[var(--border)] text-[var(--foreground)] before:bg-[var(--neutral-400)]",
        destructive: "border-[var(--danger-soft)] text-[var(--foreground)] before:bg-[var(--danger)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const alertIcons: Record<NonNullable<VariantProps<typeof alertVariants>["variant"]>, LucideIcon | null> = {
  success: CheckCircle2,
  info: Info,
  error: XCircle,
  warning: AlertTriangle,
  destructive: XCircle,
  default: null,
};

const alertIconColor: Record<NonNullable<VariantProps<typeof alertVariants>["variant"]>, string> = {
  success: "var(--success)",
  info: "var(--info)",
  error: "var(--danger)",
  warning: "var(--warning)",
  destructive: "var(--danger)",
  default: "var(--neutral-400)",
};

export interface AlertProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof alertVariants> {}

const Alert = React.forwardRef<HTMLDivElement, AlertProps>(
  ({ className, variant = "default", children, ...props }, ref) => {
    const v = variant ?? "default";
    const Icon = alertIcons[v];
    return (
      <div ref={ref} role="alert" className={cn(alertVariants({ variant }), className)} {...props}>
        {Icon ? (
          <Icon className="mt-0.5 size-5 shrink-0" style={{ color: alertIconColor[v] }} />
        ) : null}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    );
  },
);
Alert.displayName = "Alert";

const AlertTitle = React.forwardRef<HTMLParagraphElement, React.HTMLAttributes<HTMLHeadingElement>>(
  ({ className, ...props }, ref) => (
    <h5
      ref={ref}
      className={cn("mb-1 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  ),
);
AlertTitle.displayName = "AlertTitle";

const AlertDescription = React.forwardRef<
  HTMLParagraphElement,
  React.HTMLAttributes<HTMLParagraphElement>
>(({ className, ...props }, ref) => (
  <div
    ref={ref}
    className={cn("text-sm text-[var(--foreground-70)] [&_p]:leading-relaxed", className)}
    {...props}
  />
));
AlertDescription.displayName = "AlertDescription";

export { Alert, AlertTitle, AlertDescription };
