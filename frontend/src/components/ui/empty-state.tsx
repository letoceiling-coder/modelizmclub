import type { LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { blueprintGridOnLight, blueprintGridSize } from "@/lib/brand-pattern";

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  /** Simple CTA button rendered inside the actions row */
  action?: { label: string; onClick: () => void };
  /** Secondary outline button */
  secondaryAction?: { label: string; onClick: () => void };
  /**
   * - default:  dashed border, elevated bg, 56px vertical padding
   * - compact:  same border style, 32px vertical padding, smaller icon/text
   * - bare:     no border, transparent bg, 48px vertical padding — for panels/chat
   * - section:  пустой раздел страницы: без рамки, значок 48 приглушённый,
   *             заголовок body, пояснение caption, отступ 48 сверху и снизу.
   *             Пунктирная рамка на месте пустой стены читалась как поле
   *             формы — будто сюда надо что-то ввести, — а не как отсутствие
   *             содержимого.
   */
  variant?: "default" | "compact" | "bare" | "section";
  className?: string;
  /** Custom action nodes (Links, icon buttons, etc.) placed in the actions row */
  children?: ReactNode;
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  secondaryAction,
  variant = "default",
  className,
  children,
}: EmptyStateProps) {
  const isCompact = variant === "compact";
  const isSection = variant === "section";
  // Оба без рамки и подложки; отличаются размером значка и заголовка.
  const isBare = variant === "bare" || isSection;

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        !isBare && "rounded-[var(--r-card)] border border-dashed",
        isCompact
          ? "gap-[8px] px-[16px] py-[32px]"
          : isSection
            ? "gap-3 px-6 py-12"
            : "gap-[12px] px-[24px] py-[56px]",
        className,
      )}
      style={
        !isBare
          ? {
              backgroundColor: "var(--background-elevated)",
              // Blueprint grid — same brand motif as the hero, kept subtle
              // behind the icon/text (backgrounds never intercept clicks).
              backgroundImage: blueprintGridOnLight,
              backgroundSize: blueprintGridSize,
              borderColor: "var(--border-strong)",
            }
          : undefined
      }
    >
      {Icon && (
        <div
          className={cn(
            "grid place-items-center rounded-full",
            isCompact || isSection
              ? "h-[48px] w-[48px]"
              : isBare
                ? "h-[80px] w-[80px]"
                : "h-[64px] w-[64px]",
          )}
          style={
            isSection
              ? // Приглушённый, а не акцентный: пустой раздел — это сообщение
                // о том, что здесь ничего нет, а не призыв к действию. Призыв
                // ниже, отдельной кнопкой.
                { background: "var(--background-surface)", color: "var(--foreground-50)" }
              : { background: "var(--accent-soft)", color: "var(--accent)" }
          }
        >
          <Icon
            className={cn(
              isCompact || isSection
                ? "h-[22px] w-[22px]"
                : isBare
                  ? "h-[32px] w-[32px]"
                  : "h-[28px] w-[28px]",
            )}
          />
        </div>
      )}

      <div>
        <h3
          className={cn("font-semibold", isCompact || isSection ? "text-[15px]" : "text-[18px]")}
          style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
        >
          {title}
        </h3>
        {description && (
          <p
            className={cn(
              "mx-auto mt-[6px]",
              isCompact || isSection ? "max-w-[280px] text-[13px]" : "max-w-[360px] text-[14px]",
            )}
            style={{ color: "var(--foreground-70)" }}
          >
            {description}
          </p>
        )}
      </div>

      {(action || secondaryAction || children) && (
        <div className="mt-[4px] flex flex-wrap items-center justify-center gap-[8px]">
          {action && (
            <Button
              onClick={action.onClick}
              size={isSection ? "sm" : "default"}
              className="px-[20px]"
            >
              {action.label}
            </Button>
          )}
          {secondaryAction && (
            <Button
              variant="outline"
              onClick={secondaryAction.onClick}
              className="rounded-[10px] px-[16px]"
            >
              {secondaryAction.label}
            </Button>
          )}
          {children}
        </div>
      )}
    </div>
  );
}
