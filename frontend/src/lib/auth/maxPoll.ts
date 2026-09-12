import { pollMaxAuth, type MaxAuthStatus } from "@/lib/api/oauth";

/**
 * Опрос состояния входа через MAX — один на вход и на привязку.
 *
 * ЧТО БЫЛО. Оба места опрашивали `oauth/max/status` через `setInterval` раз в
 * 1,5 с — 40 запросов в минуту. Сервер пускал 10 в минуту с IP, и этот лимит
 * был общим с `oauth/max/start`. Человек, который подтверждал вход в MAX дольше
 * пятнадцати секунд, получал поток 429, опрос на ошибки не отступал, а
 * перезапустить вход было нельзя — бюджет старта съел сам опрос. Сессия
 * хранится в `sessionStorage`, и опрос возобновлялся на каждой загрузке
 * страницы, пока она не истечёт. Замер 13.09: 11–14 ответов 429 на страницу.
 *
 * ЧТО СТАЛО.
 * - Шаг 3 с — 20 запросов в минуту при лимите статуса 30 (отдельном от старта).
 * - Цепочка `setTimeout`, а не `setInterval`: следующий запрос уходит только
 *   после ответа на предыдущий, медленный сервер не получает очередь.
 * - На ошибку, включая 429, шаг удваивается до 30 с; успешный ответ
 *   возвращает его к 3 с. Заголовка `Retry-After` клиент API наружу не отдаёт,
 *   поэтому отступ по удвоению: окно лимита минутное, за 30 с оно освобождается.
 * - В скрытой вкладке опрос спит и просыпается при возврате. Человек как раз
 *   ушёл в MAX подтверждать — опрашивать в это время незачем, а вернувшись он
 *   получит ответ сразу, без ожидания шага.
 */
export const MAX_POLL_BASE_MS = 3000;
export const MAX_POLL_CAP_MS = 30000;

export interface MaxPollHandlers {
  /** Возвращает true, если опрос пора прекратить. */
  onStatus: (status: MaxAuthStatus) => boolean | Promise<boolean>;
  onExpired: () => void;
}

export function startMaxPoll(
  session: string,
  expiresAt: number,
  handlers: MaxPollHandlers,
): () => void {
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | null = null;
  let inFlight = false;
  let delay = MAX_POLL_BASE_MS;

  const schedule = (ms: number) => {
    if (stopped || timer !== null) return;
    timer = setTimeout(() => {
      timer = null;
      void tick();
    }, ms);
  };

  const tick = async () => {
    if (stopped || inFlight) return;
    if (Date.now() > expiresAt) {
      stopped = true;
      handlers.onExpired();
      return;
    }
    // Спим, пока вкладка скрыта: разбудит visibilitychange.
    if (typeof document !== "undefined" && document.hidden) return;

    inFlight = true;
    try {
      const status = await pollMaxAuth(session);
      delay = MAX_POLL_BASE_MS;
      if (stopped) return;
      if (await handlers.onStatus(status)) {
        stopped = true;
        return;
      }
    } catch {
      delay = Math.min(MAX_POLL_CAP_MS, delay * 2);
    } finally {
      inFlight = false;
    }
    schedule(delay);
  };

  const onVisibility = () => {
    if (!document.hidden) schedule(0);
  };
  document.addEventListener("visibilitychange", onVisibility);
  schedule(MAX_POLL_BASE_MS);

  return () => {
    stopped = true;
    if (timer !== null) clearTimeout(timer);
    timer = null;
    document.removeEventListener("visibilitychange", onVisibility);
  };
}
