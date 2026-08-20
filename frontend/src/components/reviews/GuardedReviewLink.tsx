import type { CSSProperties, ReactNode } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";

interface Props {
  id: string;
  children: ReactNode;
  className?: string;
  style?: CSSProperties;
}

/** List/cover stays visible; opening playback requires login, then SMS. */
export function GuardedReviewLink({ id, children, className, style }: Props) {
  const { requireAccount } = useGuestAccess();
  const navigate = useNavigate();
  const href = `/reviews/${id}`;

  return (
    <a
      href={href}
      className={className}
      style={style}
      onClick={(e) => {
        e.preventDefault();
        requireAccount(() => {
          void navigate({ to: "/reviews/$id", params: { id } });
        }, href);
      }}
    >
      {children}
    </a>
  );
}
