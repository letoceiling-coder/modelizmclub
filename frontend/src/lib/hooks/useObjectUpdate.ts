import { useEffect, useRef } from "react";
import { onObjectUpdate, type ObjectKind, type ObjectUpdate } from "@/lib/realtime/user";

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
 * Событие про то, что нас касается?
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
 * «Твой объект изменился» — перечитать то, что показано на экране.
 *
 * Перечитываем, а не правим по статусу из события: вместе со статусом
 * меняются соседние поля — сроки сделки, вкладка объявления, набор
 * доступных действий, — а их в событии нет намеренно (см.
 * `RealtimeObjectUpdate` на сервере).
 */
export function useObjectUpdate(watch: ObjectWatch, onUpdate: (u: ObjectUpdate) => void): void {
  /*
   * Обработчик держим ссылкой: иначе подписка пересоздавалась бы на каждый
   * рендер страницы — вызывающему пришлось бы оборачивать свой колбэк в
   * `useCallback`, и первый же забывший это сделал бы себе тихую течь.
   */
  const handler = useRef(onUpdate);
  handler.current = onUpdate;

  const { kind, uuid } = watch;

  useEffect(() => {
    return onObjectUpdate((u) => {
      if (!objectUpdateMatches(u, { kind, uuid })) return;
      handler.current(u);
    });
  }, [kind, uuid]);
}
