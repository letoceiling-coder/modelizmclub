import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Flame, Check, CheckCircle2, X, Info, AlertTriangle, Clock, FileEdit } from "lucide-react";
import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-md border px-2.5 py-1 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--accent)] focus:ring-offset-2",
  {
    variants: {
      variant: {
        // ТОП — filled accent
        top: "border-transparent bg-[var(--accent)] text-white",
        // ТОП — outline accent
        "top-outline": "border-[var(--border-accent)] bg-transparent text-[var(--accent)]",
        // Активен — green
        active: "border-transparent bg-[var(--success)] text-white",
        // Ошибка — neutral/grey per UI Kit
        error: "border-transparent bg-[var(--neutral-200)] text-[var(--neutral-700)]",
        // Info — blue soft
        info: "border-transparent bg-[var(--info-soft)] text-[var(--info)]",
        // Warning / commercial — orange soft
        warning: "border-transparent bg-[var(--warning-soft)] text-[var(--warning)]",
        // На модерации
        moderation: "border-transparent bg-[var(--accent-commercial-soft)] text-[var(--accent-commercial)]",
        // Опубликовано
        published: "border-transparent bg-[var(--success-soft)] text-[var(--success)]",
        // Черновик
        draft: "border-[var(--border)] bg-[var(--background-surface)] text-[var(--foreground-70)]",
        // shadcn-compat fallbacks (kept for existing call sites)
        default: "border-transparent bg-[var(--accent)] text-white",
        secondary: "border-transparent bg-[var(--background-surface)] text-[var(--foreground)]",
        destructive: "border-transparent bg-[var(--danger)] text-white",
        outline: "border-[var(--border)] text-[var(--foreground)]",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  },
);

const badgeIcons: Partial<Record<NonNullable<VariantProps<typeof badgeVariants>["variant"]>, LucideIcon>> = {
  top: Flame,
  "top-outline": Flame,
  active: Check,
  error: X,
  info: Info,
  warning: AlertTriangle,
  moderation: Clock,
  published: CheckCircle2,
  draft: FileEdit,
};

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>, VariantProps<typeof badgeVariants> {
  /** Set false to omit the leading icon that variant implies. */
  withIcon?: boolean;
}

function Badge({ className, variant, withIcon = true, children, ...props }: BadgeProps) {
  const Icon = variant ? badgeIcons[variant] : undefined;
  return (
    <div className={cn(badgeVariants({ variant }), className)} {...props}>
      {withIcon && Icon ? <Icon className="size-3" /> : null}
      {children}
    </div>
  );
}

export { Badge, badgeVariants };
