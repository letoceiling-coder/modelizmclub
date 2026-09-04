import { cloneElement, isValidElement, type MouseEvent, type ReactElement } from "react";
import type { Level } from "./levels";
import type { RequireOptions } from "./useGate";
import { useGate } from "./useGate";

interface Props {
  level: Level;
  action: () => void | Promise<void>;
  /**
   * Server-side verdict for a signed-in viewer. When the entity carries `can`
   * and the flag for this action is explicitly false, the control is not
   * rendered at all — a missing button, not a window. Guests are exempt: the
   * server answers `false` to everyone it cannot identify, and a guest must
   * see the button so the gate can open.
   */
  entity?: { can?: Record<string, boolean> | null };
  actionName?: string;
  intent?: RequireOptions["intent"];
  children: ReactElement<{ onClick?: (e: MouseEvent) => void }>;
}

/**
 * Wraps one clickable child and takes over its onClick: the action runs if
 * the viewer meets `level`, otherwise the gate opens and the action is
 * replayed after the missing step succeeds.
 */
export function Gated({ level, action, entity, actionName, intent, children }: Props) {
  const { require, level: viewerLevel } = useGate();
  if (viewerLevel !== "guest" && entity?.can && actionName && entity.can[actionName] === false)
    return null;
  if (!isValidElement(children)) return children;

  return cloneElement(children, {
    onClick: (e: MouseEvent) => {
      e.preventDefault?.();
      void require(level, action, { intent });
    },
  });
}
