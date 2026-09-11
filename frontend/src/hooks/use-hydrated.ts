import { useSyncExternalStore } from "react";

const subscribe = () => () => {};

/**
 * Returns false on the server and while server markup is being hydrated,
 * true for everything rendered after that.
 * Use to gate content that would otherwise produce a hydration mismatch
 * (Date.now()-derived strings, window.* reads, locale-formatted dates).
 *
 * Компонент, смонтированный уже в работающем приложении, получает true с
 * первого кадра. До 11.09 хук возвращал false в первом рендере любого
 * компонента, и содержимое менялось вторым кадром и после переходов, где
 * гидрации нет вовсе, — отсюда сдвиги у меток времени в мессенджере.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => true,
    () => false,
  );
}
