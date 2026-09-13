import { getSession, sessionQueryOptions } from "@/lib/session";
import { getSessionQueryClient } from "@/lib/session/queryClient";
import { firstFailingStep, levelOf, meets } from "./levels";
import { clearIntent, readIntent } from "./intent";
import { closeGate, openGate, setPendingAction, takePendingAction } from "./gateStore";
import { resumableHandler } from "./resumable";

/**
 * Called after every window succeeds (and once on host mount, for intents
 * that survived a navigation). Refetches the session, then either replays
 * the pending action, opens the *next* missing window, or navigates the
 * stored `navigate` intent.
 */
export async function resumeIntent(
  navigate?: (to: string) => void,
  onReplayed?: () => void | Promise<void>,
): Promise<void> {
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

  /*
   * Замыкания нет — значит, была полная перезагрузка (OAuth, ссылка с
   * токеном, регистрация). Если действие из тех, что описаны ключом, —
   * выполняем его сами и просим страницу перечитать данные: она могла
   * загрузиться раньше, чем действие дошло до сервера. См. resumable.ts.
   */
  const replay = resumableHandler(stored?.key);
  if (replay && stored?.params) {
    try {
      await replay(stored.params);
      await onReplayed?.();
    } catch {
      // Отказ сервера сам откроет своё окно или покажет тост через клиент API.
    }
  }
  const to = stored?.key === "navigate" ? stored.params?.to : (stored?.returnTo ?? undefined);
  if (typeof to !== "string" || !navigate) return;

  /*
   * Вернуть туда, откуда ушли.
   *
   * Замыкание действия живёт только в памяти и полную перезагрузку не
   * переживает; повторяются после неё только действия из resumable.ts, а
   * остальные — нет. Но раньше терялось и место:
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
