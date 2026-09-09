import * as React from "react";

const MOBILE_BREAKPOINT = 768;

function getServerSnapshot() {
  return false;
}

/**
 * Узкий ли экран.
 *
 * По умолчанию граница 768 — телефон против всего остального. Порог можно
 * задать: просмотрщик записи держит панель только от 1024 и спрашивает
 * именно про эту границу. Второго хука на тот же вопрос заводить незачем.
 */
export function useIsMobile(breakpoint: number = MOBILE_BREAKPOINT) {
  const subscribe = React.useCallback(
    (callback: () => void) => {
      const mql = window.matchMedia(`(max-width: ${breakpoint - 1}px)`);
      mql.addEventListener("change", callback);
      return () => mql.removeEventListener("change", callback);
    },
    [breakpoint],
  );
  const getSnapshot = React.useCallback(() => window.innerWidth < breakpoint, [breakpoint]);
  return React.useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
