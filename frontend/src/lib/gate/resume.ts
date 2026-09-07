import { getSession, sessionQueryOptions } from "@/lib/session";
import { getSessionQueryClient } from "@/lib/session/queryClient";
import { firstFailingStep, levelOf, meets } from "./levels";
import { clearIntent, readIntent } from "./intent";
import { closeGate, openGate, setPendingAction, takePendingAction } from "./gateStore";

/**
 * Called after every window succeeds (and once on host mount, for intents
 * that survived a navigation). Refetches the session, then either replays
 * the pending action, opens the *next* missing window, or navigates the
 * stored `navigate` intent.
 */
export async function resumeIntent(navigate?: (to: string) => void): Promise<void> {
  const qc = getSessionQueryClient();
  if (qc) {
    try {
      await qc.fetchQuery({ ...sessionQueryOptions, staleTime: 0 });
    } catch {
      // error state — levelOf() falls back to the cached value below
    }
  }
  const have = levelOf(getSession());
  const pending = takePendingAction();
  const stored = readIntent();
  const need = pending?.level ?? stored?.level;

  if (need && !meets(have, need)) {
    if (pending) setPendingAction(pending);
    const step = firstFailingStep(have, need);
    if (step) openGate(step, pending?.intent.returnTo ?? stored?.returnTo);
    return;
  }

  closeGate();
  clearIntent();
  if (pending) {
    await pending.run();
    return;
  }
  const to = stored?.key === "navigate" ? stored.params?.to : (stored?.returnTo ?? undefined);
  if (typeof to !== "string" || !navigate) return;

  /*
   * Вернуть туда, откуда ушли.
   *
   * Замыкание действия живёт только в памяти и полную перезагрузку не
   * переживает, поэтому лайк после возврата из OAuth не повторится — это
   * известное ограничение, а не недосмотр. Но раньше терялось и место:
   * гость на /ads/{id} жал закрытое действие, входил через VK и оказывался
   * в ленте. Теперь по крайней мере возвращается на свою страницу.
   */
  if (
    typeof window !== "undefined" &&
    `${window.location.pathname}${window.location.search}` === to
  ) {
    return;
  }
  navigate(to);
}
