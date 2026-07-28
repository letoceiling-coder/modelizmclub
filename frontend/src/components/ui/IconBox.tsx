import type { CSSProperties, ReactNode } from "react";
import { cn } from "@/lib/utils";

export type IconBoxSize = "sm" | "md" | "lg" | "xl";
export type IconBoxVariant = "accent-soft" | "surface" | "elevated" | "none";

const SIZE_CLASS: Record<IconBoxSize, string> = {
  sm: "icon-box--sm",
  md: "icon-box--md",
  lg: "icon-box--lg",
  xl: "icon-box--xl",
};

const VARIANT_CLASS: Record<Exclude<IconBoxVariant, "none">, string> = {
  "accent-soft": "icon-box--accent-soft",
  surface: "icon-box--surface",
  elevated: "icon-box--elevated",
};

/** Square container for feature/landing icons — children should use `fill` on Icon components. */
export function IconBox({
  size = "lg",
  variant = "accent-soft",
  className,
  style,
  children,
}: {
  size?: IconBoxSize;
  variant?: IconBoxVariant;
  className?: string;
  style?: CSSProperties;
  children: ReactNode;
}) {
  return (
    <div
      className={cn(
        "icon-box",
        SIZE_CLASS[size],
        variant !== "none" && VARIANT_CLASS[variant],
        className,
      )}
      style={style}
    >
      <span className="icon-box__inner">{children}</span>
    </div>
  );
}
