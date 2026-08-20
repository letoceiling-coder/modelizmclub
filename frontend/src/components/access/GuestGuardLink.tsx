import type { ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";

interface Props {
  actionKey: string;
  to: string;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  title?: string;
  "aria-label"?: string;
  onAttempt?: () => void;
}

/** Internal navigation link guarded for guest access. */
export function GuestGuardLink({ actionKey, to, children, className, style, title, "aria-label": ariaLabel, onAttempt }: Props) {
  const { guardAction } = useGuestAccess();
  const navigate = useNavigate();

  return (
    <a
      href={to}
      className={className}
      style={style}
      title={title}
      aria-label={ariaLabel}
      onClick={(e) => {
        e.preventDefault();
        onAttempt?.();
        guardAction(actionKey, () => {
          void navigate({ to: to as "/feed" });
        }, to);
      }}
    >
      {children}
    </a>
  );
}

interface ButtonProps {
  actionKey: string;
  onAllowed: () => void;
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
  type?: "button" | "submit";
  disabled?: boolean;
  "aria-label"?: string;
}

export function GuestGuardButton({ actionKey, onAllowed, children, className, style, type = "button", disabled, "aria-label": ariaLabel }: ButtonProps) {
  const { guardAction } = useGuestAccess();

  return (
    <button
      type={type}
      className={className}
      style={style}
      disabled={disabled}
      aria-label={ariaLabel}
      onClick={() => guardAction(actionKey, onAllowed)}
    >
      {children}
    </button>
  );
}
