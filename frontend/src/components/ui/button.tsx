import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { ChevronDown, Loader2 } from "lucide-react";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-[var(--r-button)] text-sm font-medium cursor-pointer transition-[color,background-color,border-color,box-shadow,transform] active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)] disabled:pointer-events-none disabled:cursor-not-allowed disabled:active:scale-100 [&_svg]:pointer-events-none [&_svg]:size-4 [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // Primary — brand accent (preset-driven). Text uses --accent-foreground
        // so menthol gets dark ink and blue gets white (contrast-safe).
        default:
          "bg-[var(--accent)] text-[var(--accent-foreground)] shadow-[var(--shadow-button)] hover:bg-[var(--accent-hover)] disabled:bg-[var(--neutral-200)] disabled:text-[var(--neutral-400)] disabled:shadow-none",
        // Secondary / dark — solid dark fill, "Доп кнопка" in UI Kit
        secondary:
          "bg-[var(--neutral-900)] text-white hover:bg-[var(--neutral-700)] disabled:bg-[var(--neutral-200)] disabled:text-[var(--neutral-400)]",
        // Outline — bordered, fills with accent-soft on hover
        outline:
          "border border-[var(--border)] bg-transparent text-[var(--foreground)] hover:border-[var(--accent)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:border-[var(--neutral-200)] disabled:text-[var(--neutral-400)] disabled:hover:bg-transparent",
        // Ghost — text only, accent-soft hover background
        ghost:
          "text-[var(--foreground)] hover:bg-[var(--accent-soft)] hover:text-[var(--accent)] disabled:text-[var(--neutral-400)]",
        // Commercial — promo / paid placement CTA, ex-primary orange
        commercial:
          "bg-[var(--accent-commercial)] text-white shadow-[var(--shadow-button-commercial)] hover:bg-[var(--accent-commercial-hover)] disabled:bg-[var(--neutral-200)] disabled:text-[var(--neutral-400)] disabled:shadow-none",
        destructive:
          "bg-[var(--danger)] text-white shadow-sm hover:opacity-90 disabled:bg-[var(--neutral-200)] disabled:text-[var(--neutral-400)]",
        link: "text-[var(--accent)] underline-offset-4 hover:underline disabled:text-[var(--neutral-400)]",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-8 rounded-[var(--r-button)] px-3 text-xs",
        lg: "h-11 rounded-[var(--r-button)] px-8",
        icon: "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
  /** Shows a unified spinner and disables the button. Ignored with asChild. */
  loading?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, loading = false, disabled, children, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    // asChild wraps arbitrary elements (e.g. <Link>) — Slot needs a single child
    // and can't take `disabled`, so the spinner/disable only apply to real buttons.
    if (asChild) {
      return (
        <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} disabled={disabled} {...props}>
          {children}
        </Comp>
      );
    }
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        disabled={disabled || loading}
        aria-busy={loading || undefined}
        {...props}
      >
        {loading && <Loader2 className="animate-spin" aria-hidden />}
        {children}
      </Comp>
    );
  },
);
Button.displayName = "Button";

/**
 * SplitButton — primary action + a separate dropdown trigger, divided by a
 * 1px hairline (UI Kit 2.0 "Кнопка ⌄"). Composed from Button so it inherits
 * variant theming; the dropdown half always uses size="icon" semantics.
 */
export interface SplitButtonProps extends Omit<ButtonProps, "size"> {
  size?: Exclude<VariantProps<typeof buttonVariants>["size"], "icon">;
  onDropdownClick?: () => void;
  dropdownLabel?: string;
}

const SplitButton = React.forwardRef<HTMLButtonElement, SplitButtonProps>(
  ({ className, variant = "default", size = "default", onDropdownClick, dropdownLabel = "Открыть меню", children, ...props }, ref) => {
    const dividerColor =
      variant === "default" || variant === "secondary" || variant === "commercial" || variant === "destructive"
        ? "rgba(255,255,255,0.35)"
        : "var(--border)";
    return (
      <div className="inline-flex">
        <Button
          ref={ref}
          variant={variant}
          size={size}
          className={cn("rounded-r-none", className)}
          {...props}
        >
          {children}
        </Button>
        <Button
          type="button"
          variant={variant}
          size={size}
          aria-label={dropdownLabel}
          onClick={onDropdownClick}
          className="rounded-l-none border-l-0 px-2.5"
          style={{ boxShadow: "none", borderLeft: `1px solid ${dividerColor}` }}
        >
          <ChevronDown />
        </Button>
      </div>
    );
  },
);
SplitButton.displayName = "SplitButton";

export { Button, SplitButton, buttonVariants };
