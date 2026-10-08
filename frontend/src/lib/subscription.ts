// Subscription state — real API in production, honest demo constants on demo
// hosts. Shared by the sidebar status line and /subscription.
import { useEffect, useState } from "react";
import { isDemoMode } from "@/lib/demo-mode";
import { fetchMySubscription, type MySubscription } from "@/lib/api/payment";
import { isAuthenticated } from "@/lib/auth/session";
import { useSessionResolved } from "@/lib/session";
import { formatDate } from "@/lib/format/date";

/** Demo-only constants (neeklo stand / local dev — no billing backend). */
const DEMO_DAYS_LEFT = 287;

function demoSubscription(): MySubscription {
  return {
    id: 0,
    status: "active",
    starts_at: null,
    ends_at: new Date(Date.now() + DEMO_DAYS_LEFT * 86400000).toISOString(),
    auto_renew: false,
    is_active: true,
    days_left: DEMO_DAYS_LEFT,
    plan: {
      id: 0,
      slug: "year",
      name: "Год",
      description: null,
      price_cents: 79900,
      price_rub: 799,
      period_days: 365,
      features: [],
      badge_label: null,
      sort_order: 0,
    },
  };
}

let cache: MySubscription | null | undefined;
let inflight: Promise<MySubscription | null> | null = null;
const listeners = new Set<() => void>();

/*
 * Подсказка «в прошлый раз подписка была активна». Нужна не для прав — права
 * решает сервер, — а для места под карточку статуса на `/subscription`.
 *
 * Серверная разметка анонимна: токен лежит в localStorage, загрузчику его не
 * достать. Карточка появляется после ответа `fetchMySubscription()` и уносит
 * вниз всё, что под ней: измерено 12.09 на проде — 0,1309 при 375, 0,0825 при
 * 768, 0,0454 при 1440, по три прогона. У гостя и у вошедшего без подписки
 * сдвиг ~0,0004: карточки у них нет вовсе.
 *
 * Поэтому подсказка, а не «зарезервировать всем вошедшим»: последнее сломало
 * бы как раз тех, у кого сейчас чисто. Флаг читается скриптом до первой
 * отрисовки (`routes/__root.tsx`) и ставит `data-sub` на `<html>`; разметка
 * при этом одна и та же в обоих случаях, поэтому гидрация не расходится.
 */
const SUB_HINT_KEY = "mc_sub_active";

function rememberSubscriptionHint(active: boolean): void {
  if (typeof document === "undefined") return;
  try {
    if (active) localStorage.setItem(SUB_HINT_KEY, "1");
    else localStorage.removeItem(SUB_HINT_KEY);
  } catch {
    // Приватный режим: подсказки не будет, останется прежний сдвиг — не ошибка.
  }
  if (active) document.documentElement.setAttribute("data-sub", "1");
  else document.documentElement.removeAttribute("data-sub");
}

/** Current subscription (module-level cache, one request per SPA session). */
export async function getMySubscription(force = false): Promise<MySubscription | null> {
  if (isDemoMode()) return demoSubscription();
  /*
   * На сервере не отвечаем и ничего не запоминаем.
   *
   * Процесс Node живёт сутками, а `cache` — модульная переменная: по
   * правилу из CLAUDE.md ответ одному посетителю не должен зависеть от
   * предыдущего. Сейчас эту функцию зовут только из эффектов, то есть на
   * сервере она не выполняется, — но ветка «не вошёл» ниже пишет
   * `cache = null`, и один такой вызов с сервера отравил бы процесс
   * целиком: у всех следующих посетителей серверная разметка говорила бы
   * «подписки нет» при `loading === false`, в том числе у подписчиков, а
   * первый кадр браузера с ней расходился бы.
   *
   * Поэтому запрет здесь, а не надежда на то, что загрузчик не появится.
   */
  if (typeof window === "undefined") return null;
  if (!isAuthenticated()) {
    cache = null;
    rememberSubscriptionHint(false);
    return null;
  }
  if (!force && cache !== undefined) return cache;
  if (!inflight || force) {
    inflight = fetchMySubscription()
      .then((sub) => {
        cache = sub?.is_active ? sub : null;
        rememberSubscriptionHint(cache !== null);
        return cache;
      })
      .catch(() => {
        inflight = null; // let the next call retry after a transient failure
        return null;
      });
  }
  return inflight;
}

/** Drop the cached subscription (after a successful payment). */
export function invalidateMySubscription(): void {
  cache = undefined;
  inflight = null;
  listeners.forEach((fn) => fn());
}

/** React hook over getMySubscription(). `sub` is null when on the free tier. */
export function useMySubscription(): { sub: MySubscription | null; loading: boolean } {
  const sessionReady = useSessionResolved();
  const [sub, setSub] = useState<MySubscription | null>(() => cache ?? null);
  /*
   * Начальное «грузится» — по кэшу, без чтения токена.
   *
   * Стояло `isAuthenticated() && cache === undefined`. Токен лежит в
   * localStorage: на сервере его нет, в браузере при гидрации уже есть, —
   * то есть первое значение расходилось у сервера и первого кадра. Это та
   * самая причина React #418 из CLAUDE.md, и правило там названо прямо:
   * «токен в разметке — useHasToken(), не getToken() / isAuthenticated()».
   *
   * Замером расхождения не дало: обход боевой сборкой по 25 маршрутам в
   * трёх состояниях чист и до правки. Значит это не починка найденного
   * дефекта, а снятие запрещённого приёма — ровно так и записано, чтобы
   * никто не искал в журнале сломанный экран.
   *
   * Почему именно `cache === undefined`, а не `false`: пока ответа нет,
   * `loading` обязан быть истиной **с первого кадра**. На нём висит
   * `needsSubscription` в GuestAccessProvider — с `!subLoading`, — и
   * мгновение `loading === false` при `sub === null` открыло бы окно
   * «нужна подписка» подписчику. `cache` на сервере и в первом кадре
   * браузера одинаков (undefined), поэтому разметка совпадает, а гостю
   * достаётся один лишний кадр «грузится», на котором ничего не висит:
   * у него `isGuest` и так отменяет проверку подписки.
   */
  const [loading, setLoading] = useState(() => cache === undefined);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const onInvalidate = () => setTick((n) => n + 1);
    listeners.add(onInvalidate);
    return () => {
      listeners.delete(onInvalidate);
    };
  }, []);

  useEffect(() => {
    if (!sessionReady) return;
    let alive = true;
    void getMySubscription(tick > 0)
      .then((s) => {
        if (alive) setSub(s);
      })
      .finally(() => {
        if (alive) setLoading(false);
      });
    return () => {
      alive = false;
    };
  }, [sessionReady, tick]);

  return { sub, loading };
}

export function formatSubscriptionEndDate(sub: MySubscription | null): string {
  if (!sub?.ends_at) return "";
  return formatDate(sub.ends_at, "date");
}
