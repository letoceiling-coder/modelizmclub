import { useCallback, useLayoutEffect, useRef, type RefObject } from "react";

/**
 * Вставка в позицию курсора для однострочного поля или текстовой области.
 *
 * Механизм был написан дважды — в мессенджере и в чате направления, — а в
 * композере комментариев его не было вовсе: там смайл просто дописывался в
 * конец строки (`v + emoji`). Человек ставил курсор в середину фразы,
 * нажимал смайл и получал его в хвосте. Найдено 09.09 на проде.
 *
 * Ref может смотреть в никуда: панель смайлов живёт в портале и переживает
 * перерисовку композера. Тогда дописываем в конец — это хуже, чем вставка
 * по месту, но лучше, чем потерянный символ.
 */
export function insertAtCaret(
  el: HTMLInputElement | HTMLTextAreaElement | null,
  value: string,
  insert: string,
): { next: string; caret: number } {
  if (!el) {
    return { next: value + insert, caret: value.length + insert.length };
  }

  const start = el.selectionStart ?? value.length;
  const end = el.selectionEnd ?? value.length;

  return {
    next: value.slice(0, start) + insert + value.slice(end),
    caret: start + insert.length,
  };
}

/**
 * Готовый обработчик для панели смайлов: вставляет по курсору и возвращает
 * курсор за вставленный символ, чтобы продолжать печатать с того же места.
 *
 * Курсор ставится в следующем кадре: до перерисовки поле ещё показывает
 * старое значение, и `setSelectionRange` пришёлся бы по нему.
 */
export function useInsertAtCaret<T extends HTMLInputElement | HTMLTextAreaElement>(
  ref: RefObject<T | null>,
  value: string,
  setValue: (next: string) => void,
): (insert: string) => void {
  const pendingCaret = useRef<number | null>(null);

  /*
   * Курсор ставится после того, как React запишет новое значение в поле, а
   * не в следующем кадре.
   *
   * Кадр наступал раньше отрисовки: `setSelectionRange` приходился по
   * старому значению, а следующая отрисовка сбрасывала курсор в конец
   * строки. Вставка при этом была верной — «аб😀вгд», — но продолжать
   * печатать приходилось с хвоста. Замерено 09.09 на стенде: просили 4,
   * получали 7.
   */
  useLayoutEffect(() => {
    const caret = pendingCaret.current;
    if (caret === null) return;
    pendingCaret.current = null;
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(caret, caret);
  }, [value, ref]);

  return useCallback(
    (insert: string) => {
      const { next, caret } = insertAtCaret(ref.current, value, insert);
      pendingCaret.current = caret;
      setValue(next);
    },
    [ref, value, setValue],
  );
}
