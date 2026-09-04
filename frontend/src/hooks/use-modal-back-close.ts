import * as React from "react";

/** Маркер «наша» записи истории — по нему отличаем свою запись от чужой. */
const MODAL_STATE_KEY = "__modelizmModal";
/** Ключ индекса истории из @tanstack/history: без него роутер не посчитает delta. */
const TSR_INDEX_KEY = "__TSR_index";

let sequence = 0;

type HistoryState = Record<string, unknown>;

function readState(): HistoryState {
  return (window.history.state as HistoryState | null) ?? {};
}

/**
 * Аппаратная «назад» на Android (и свайп-назад в браузере) должна закрывать
 * открытое окно, а не уводить со страницы.
 *
 * При открытии кладём в историю пустую запись с тем же href (роутер её
 * игнорирует — адрес не изменился), на popstate закрываем окно. Если окно
 * закрыли крестиком/Esc/свайпом, запись снимаем сами — но только если она всё
 * ещё текущая: внутри окна могла произойти навигация, и тогда back() увёл бы
 * пользователя не туда.
 */
export function useModalBackClose(open: boolean, onClose: (open: false) => void): void {
  const closeRef = React.useRef(onClose);
  closeRef.current = onClose;

  React.useEffect(() => {
    if (typeof window === "undefined" || !open) return;

    const id = ++sequence;
    let ours = true;
    const prev = readState();
    const index = typeof prev[TSR_INDEX_KEY] === "number" ? (prev[TSR_INDEX_KEY] as number) : 0;
    window.history.pushState({ ...prev, [TSR_INDEX_KEY]: index + 1, [MODAL_STATE_KEY]: id }, "");

    const onPop = () => {
      // Браузер уже снял нашу запись — возвращать её назад не нужно.
      ours = false;
      closeRef.current(false);
    };
    window.addEventListener("popstate", onPop);

    return () => {
      window.removeEventListener("popstate", onPop);
      if (ours && readState()[MODAL_STATE_KEY] === id) window.history.back();
    };
  }, [open]);
}
