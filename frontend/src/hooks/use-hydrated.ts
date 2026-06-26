import { useEffect, useState } from "react";

/**
 * Returns true once the component has mounted on the client.
 * Use to gate content that would otherwise produce a hydration mismatch
 * (Date.now()-derived strings, window.* reads, locale-formatted dates).
 */
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
