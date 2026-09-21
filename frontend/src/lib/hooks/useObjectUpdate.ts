import { useEffect, useRef } from "react";
import { onObjectUpdate, type ObjectKind, type ObjectUpdate } from "@/lib/realtime/user";
import { onEchoReconnect } from "@/lib/realtime/echo";
import { ignoreFailure } from "@/lib/errors/handle";

/**
 * Кого слушаем: вид объекта и, если экран показывает один конкретный, его
 * идентификатор. Без `uuid` подходит любой объект этого вида — так устроены
 * списки: у них меняется не только карточка, но и вкладка, на которой она
 * живёт, и счётчик рядом.
 */
export interface ObjectWatch {
  kind: ObjectKind;
  uuid?: string | null;
}

/**
 * Событие касается этого экрана?
 *
 * Отдельной чистой функцией, потому что ошибиться здесь легко и молча:
 * забытая проверка `uuid` на странице сделки заставляет её перечитываться
 * на каждый чужой шаг, а лишняя — не перечитываться вовсе. Ни то, ни другое
 * на экране не видно без второго окна и модератора рядом.
 */
export function objectUpdateMatches(update: ObjectUpdate, watch: ObjectWatch): boolean {
  if (update.kind !== watch.kind) return false;
  if (watch.uuid === undefined || watch.uuid === null) return true;

  return update.uuid === watch.uuid;
}

/**
 * Склейка: несколько изменений подряд перечитывают один раз.
 *
 * Планировщик выпускает до сотни отложенных записей за прогон, а разбор
 * платежа трогает объявление трижды. Без задержки каждое из этих изменений
 * поднимало бы свой запрос — по пятьдесят записей ленты в ответе.
 */
const СКЛЕЙКА_МС = 250;

/**
 * «Твой объект изменился» — низкоуровневая подписка.
 *
 * Для экранов, которые перечитывают себя сами и гонку снимают своими
 * средствами: перезапуском эффекта или `invalidateQueries` у react-query.
 * Если экран ходит за данными руками — берите `useObjectReload` ниже, он
 * снимает гонку за вас.
 */
export function useObjectUpdate(watch: ObjectWatch, onUpdate: () => void): void {
  /*
   * Обработчик держим ссылкой: иначе подписка пересоздавалась бы на каждый
   * рендер страницы — вызывающему пришлось бы оборачивать свой колбэк в
   * `useCallback`, и первый же забывший сделал бы себе тихую течь.
   */
  const handler = useRef(onUpdate);
  useEffect(() => {
    handler.current = onUpdate;
  });

  const { kind, uuid } = watch;

  useEffect(() => {
    let таймер: ReturnType<typeof setTimeout> | null = null;
    const позвать = () => {
      if (таймер !== null) clearTimeout(таймер);
      таймер = setTimeout(() => {
        таймер = null;
        handler.current();
      }, СКЛЕЙКА_МС);
    };

    const offUpdate = onObjectUpdate((u) => {
      if (!objectUpdateMatches(u, { kind, uuid })) return;
      позвать();
    });

    /*
     * Пока сокет лежал, событий не было вовсе: `UserRealtimeEvent` вещается
     * немедленно, без очереди и без истории. Ноутбук закрыли на час, открыли
     * — объявление всё ещё «на проверке», хотя одобрено сорок минут назад.
     * Поэтому на восстановление связи экран перечитывается сам.
     */
    const offReconnect = onEchoReconnect(позвать);

    return () => {
      if (таймер !== null) clearTimeout(таймер);
      offUpdate();
      offReconnect();
    };
  }, [kind, uuid]);
}

/**
 * «Твой объект изменился» — перечитать то, что показано на экране.
 *
 * Перечитываем, а не правим по статусу из события: вместе со статусом
 * меняются соседние поля — сроки сделки, вкладка объявления, набор
 * доступных действий, — а их в событии нет намеренно (см.
 * `RealtimeObjectUpdate` на сервере).
 *
 * Загрузка и применение разделены не ради красоты. Событий на одно действие
 * приходит несколько, и ответы возвращаются не в том порядке, в каком ушли:
 * вторая сторона жмёт «Отправлено», затем «Доставлено» — приходит два
 * запроса, ответ первого приезжает вторым, и экран откатывается на
 * «отправлено» навсегда, потому что следующего события уже не будет. Здесь
 * поздний ответ отбрасывается по номеру поколения — тот же приём, что в
 * `realtime/hub.ts`. Отдельным вызовам это приходилось бы помнить каждый
 * раз, и четыре экрана из шести помнить забыли.
 */
export function useObjectReload<T>(
  watch: ObjectWatch,
  load: () => Promise<T>,
  apply: (value: T) => void,
  reason: string,
): void {
  const свежее = useRef({ load, apply, reason });
  useEffect(() => {
    свежее.current = { load, apply, reason };
  });

  const поколение = useRef(0);

  useObjectUpdate(watch, () => {
    const моё = ++поколение.current;
    const { load: загрузить, apply: применить, reason: причина } = свежее.current;
    загрузить()
      .then((value) => {
        if (моё !== поколение.current) return;
        применить(value);
      })
      .catch(ignoreFailure(причина));
  });
}
