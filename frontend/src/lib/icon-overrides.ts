// frontend/src/lib/icon-overrides.ts
// Модуль-стор опубликованной карты icon_overrides + локального draft-оверлея
// (превью в браузере админа до публикации). По образцу config/featureFlags.ts.
import { useSyncExternalStore } from "react";
import { fetchIconOverrides, type IconOverride, type IconOverrideMap } from "@/lib/api/icons";

const EVENT = "modelizm:icon-overrides-changed";

let published: IconOverrideMap = {};
let draft: IconOverrideMap = {};              // slotKey → override (для превью)
const draftCleared = new Set<string>();       // слоты, сброшенные на дефолт в черновике
let fetchStarted = false;

function notify() {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(EVENT));
}

export function getPublishedOverride(slotKey: string): IconOverride | null {
  return published[slotKey] ?? null;
}

function mergedFor(slotKey: string): IconOverride | null {
  if (draftCleared.has(slotKey)) return null;    // явный сброс в черновике
  return draft[slotKey] ?? published[slotKey] ?? null;
}

export function getMergedMap(): IconOverrideMap {
  const map: IconOverrideMap = { ...published };
  for (const k of draftCleared) delete map[k];
  for (const [k, v] of Object.entries(draft)) map[k] = v;
  return map;
}

export function setDraftOverride(slotKey: string, override: IconOverride | null): void {
  if (override === null) {
    delete draft[slotKey];
    draftCleared.add(slotKey);
  } else {
    draftCleared.delete(slotKey);
    draft[slotKey] = override;
  }
  notify();
}

export function resetDraft(): void {
  draft = {};
  draftCleared.clear();
  notify();
}

export function applyPublishedMap(map: IconOverrideMap): void {
  published = map ?? {};
  draft = {};
  draftCleared.clear();
  notify();
}

export async function loadIconOverridesFromServer(): Promise<void> {
  if (typeof window === "undefined") return;
  const map = await fetchIconOverrides(); // demo → localStorage; real → GET /icon-overrides; ошибка → {}
  published = map;
  notify();
}

// Само-инициализация при импорте (как featureFlags.ts). В demo тоже грузим —
// fetchIconOverrides сам читает localStorage.
if (typeof window !== "undefined" && !fetchStarted) {
  fetchStarted = true;
  void loadIconOverridesFromServer();
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Реактивно возвращает актуальный override (draft поверх published) или null. */
export function useIconOverride(slotKey: string): IconOverride | null {
  return useSyncExternalStore(
    subscribe,
    () => mergedFor(slotKey),
    () => null, // SSR: всегда fallback на lucide
  );
}
