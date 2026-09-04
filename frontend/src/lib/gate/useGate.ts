import { useCallback } from "react";
import { getSession, useSession } from "@/lib/session";
import { firstFailingStep, levelOf, meets, type Level } from "./levels";
import { currentPath, saveIntent, type Intent } from "./intent";
import { openGate, setPendingAction } from "./gateStore";

export type GateAction = () => void | Promise<void>;

export interface RequireOptions {
  intent?: Omit<Intent, "createdAt" | "level">;
}

/**
 * Imperative form for code outside React (route guards, links). Runs the
 * action when the viewer already meets `need`; otherwise remembers it and
 * opens exactly one window — the first missing rung.
 */
export async function gateRequire(
  need: Level,
  action: GateAction,
  options: RequireOptions = {},
): Promise<boolean> {
  const have = levelOf(getSession());
  if (meets(have, need)) {
    await action();
    return true;
  }
  const intent: Intent = {
    key: options.intent?.key ?? "action",
    params: options.intent?.params,
    returnTo: options.intent?.returnTo ?? currentPath(),
    level: need,
    createdAt: Date.now(),
  };
  saveIntent(intent);
  setPendingAction({ level: need, run: action, intent });
  const step = firstFailingStep(have, need);
  if (step) openGate(step, intent.returnTo);
  return false;
}

/**
 * `const { require } = useGate(); require("subscriber", () => like())`
 * — the only way a component asks "may I?". Reads the session query, so the
 * answer updates the moment the user signs in, verifies or subscribes.
 */
export function useGate() {
  const session = useSession();
  const level = levelOf(session.data);

  const require = useCallback(
    (need: Level, action: GateAction, options?: RequireOptions) =>
      gateRequire(need, action, options),
    [],
  );

  const can = useCallback((need: Level) => meets(level, need), [level]);

  return { level, require, can, resolved: !session.isPending };
}
