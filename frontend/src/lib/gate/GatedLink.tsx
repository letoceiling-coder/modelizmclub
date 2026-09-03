import { Link, useNavigate, type LinkProps } from "@tanstack/react-router";
import type { MouseEvent } from "react";
import { getSession } from "@/lib/session";
import { levelOf, meets, type Level } from "./levels";
import { gateRequire } from "./useGate";

type Props = LinkProps & {
  level: Level;
  className?: string;
  onClick?: (e: MouseEvent<HTMLAnchorElement>) => void;
};

/**
 * A router Link that opens the gate instead of navigating when the viewer
 * lacks `level`. The navigation itself becomes the pending intent, so it
 * completes on its own once the user signs in / verifies / subscribes.
 */
export function GatedLink({ level, onClick, ...link }: Props) {
  const navigate = useNavigate();
  const to = typeof link.to === "string" ? link.to : "/feed";

  return (
    <Link
      {...link}
      onClick={(e: MouseEvent<HTMLAnchorElement>) => {
        onClick?.(e);
        if (e.defaultPrevented) return;
        if (meets(levelOf(getSession()), level)) return;
        e.preventDefault();
        void gateRequire(level, () => navigate({ to: to as "/feed" }), {
          intent: { key: "navigate", params: { to } },
        });
      }}
    />
  );
}
