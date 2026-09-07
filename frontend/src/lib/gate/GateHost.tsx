import { useEffect, useRef } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useSession } from "@/lib/session";
import { AuthDialog } from "./AuthDialog";
import { PaywallDialog } from "./PaywallDialog";
import { VerifyPhoneDialog } from "./VerifyPhoneDialog";
import { closeGate, setPendingAction, useGateState } from "./gateStore";
import { clearIntent, readIntent } from "./intent";
import { levelOf, meets } from "./levels";
import { resumeIntent } from "./resume";

/**
 * Mounted once in the root. Renders whichever single window the gate store
 * asks for, and resumes the stored intent after a success — or on mount,
 * when the user comes back from /register or an OAuth round-trip already
 * meeting the level they were missing.
 */
export function GateHost() {
  const { open, returnTo } = useGateState();
  const navigate = useNavigate();
  const session = useSession();
  const resumed = useRef(false);

  const go = (to: string) => void navigate({ to: to as "/feed" });

  const level = levelOf(session.data);

  /*
   * Проверка намерения повторяется при каждой смене уровня, а не один раз.
   *
   * Раньше здесь стоял разовый `bootChecked`, и на возврате из OAuth он
   * сгорал впустую: `/login?oauth_token=…` монтирует хост, пока сессия ещё
   * гостевая, проверка видит непройденный уровень, взводит флаг — и токен
   * применяется мгновением позже, когда возвращаться уже некому.
   *
   * Замер прода 07.09: гость жмёт «Нравится», входит по ссылке с токеном,
   * возвращается в ленту — лайка нет, окна нет, сообщения нет, а
   * `gate.intent` так и лежит в sessionStorage. Обычная перезагрузка той же
   * страницы с тем же намерением его снимала: механизм был рабочий,
   * не срабатывал только порядок.
   *
   * `resumed` не даёт возобновить дважды, если уровень поднимется ещё раз
   * до того, как `resumeIntent` дочистит намерение.
   */
  useEffect(() => {
    if (session.isPending) return;
    const stored = readIntent();
    if (!stored) {
      resumed.current = false;
      return;
    }
    if (!stored.level) {
      clearIntent();
      return;
    }
    if (!meets(level, stored.level)) return;
    if (resumed.current) return;
    resumed.current = true;
    void resumeIntent(go);
    // Намерение с непройденным уровнем остаётся лежать: пользователь откроет
    // окно сам, повторив действие. Ничего не всплывает без спроса.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session.isPending, level]);

  const dismiss = (next: boolean) => {
    if (next) return;
    closeGate();
    setPendingAction(null);
  };

  return (
    <>
      <AuthDialog
        open={open === "auth"}
        returnTo={returnTo}
        onOpenChange={dismiss}
        onSuccess={() => void resumeIntent(go)}
      />
      <VerifyPhoneDialog
        open={open === "verify"}
        onOpenChange={dismiss}
        onSuccess={() => void resumeIntent(go)}
      />
      <PaywallDialog open={open === "paywall"} returnTo={returnTo} onOpenChange={dismiss} />
    </>
  );
}
