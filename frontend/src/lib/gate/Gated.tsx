import { cloneElement, isValidElement, useRef, type MouseEvent, type ReactElement } from "react";
import { controlForServerVerdict, meets, type Level } from "./levels";
import type { RequireOptions } from "./useGate";
import { useGate } from "./useGate";

interface Props {
  level: Level;
  action: () => void | Promise<void>;
  /**
   * Server-side verdict for a signed-in viewer (`can[actionName]`). What a
   * `false` means depends on who hears it — see `controlForServerVerdict`:
   * a guest and a user without SMS still see the button (their click opens
   * the window that lifts the refusal); only a verified viewer loses it.
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
  const verdict = actionName && entity?.can ? entity.can[actionName] : undefined;
  const control = controlForServerVerdict(viewerLevel, verdict);

  // Вердикт сервера приходит вместе с записью и после подтверждения номера
  // не обновляется: человек уже на ступени «подтвердил», а в карточке всё ещё
  // «нельзя». Без памяти кнопка исчезала бы ровно в момент первого лайка,
  // ради которого он и подтверждал номер. Раз показали её через
  // подтверждение — дальше не прячем.
  const shownForVerification = useRef(false);
  if (control === "verify") shownForVerification.current = true;
  if (control === "hide" && !shownForVerification.current) return null;
  if (!isValidElement(children)) return children;

  // Отказ сервера вошедшему без SMS снимает только подтверждение номера —
  // какую бы ступень ни просила карта доступа.
  const need: Level = control === "verify" && !meets(level, "verified") ? "verified" : level;

  return cloneElement(children, {
    onClick: (e: MouseEvent) => {
      e.preventDefault?.();
      void require(need, action, { intent });
    },
  });
}
