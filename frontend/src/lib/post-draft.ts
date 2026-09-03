// Persisted draft for the feed "Новый пост" composer so an interrupted
// publication (closed modal / page reload) can be restored.
//
// Photos are binary, so we serialise them as data URLs in localStorage with a
// hard size budget. If the images are too large to persist we still keep the
// text fields and flag `photosDropped` so the UI can tell the user their photos
// could not be restored — the important text is never lost.

const KEY = "mc:post-draft:v1";
// localStorage is typically capped at ~5MB per origin; stay under it.
const MAX_BYTES = 4_500_000;

export interface DraftPhoto {
  name: string;
  type: string;
  dataUrl: string;
}

export interface PersistedPostDraft {
  title: string;
  text: string;
  catId: string;
  subId: string;
  photos: DraftPhoto[];
  photosDropped?: boolean;
  savedAt: number;
}

export function isDraftMeaningful(
  d: Pick<PersistedPostDraft, "title" | "text" | "photos">,
): boolean {
  return Boolean(d.title.trim() || d.text.trim() || d.photos.length > 0);
}

export function readPostDraft(): PersistedPostDraft | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return null;
    const data = JSON.parse(raw) as PersistedPostDraft;
    if (typeof data?.text !== "string" || !Array.isArray(data.photos)) return null;
    return data;
  } catch {
    return null;
  }
}

export function clearPostDraft(): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.removeItem(KEY);
  } catch {
    /* ignore */
  }
}

/** Persists the draft, degrading gracefully if the photos exceed the budget. */
export function writePostDraft(draft: PersistedPostDraft): void {
  if (typeof localStorage === "undefined") return;
  if (!isDraftMeaningful(draft)) {
    clearPostDraft();
    return;
  }

  const tryStore = (payload: PersistedPostDraft): boolean => {
    try {
      const serialized = JSON.stringify(payload);
      if (serialized.length > MAX_BYTES) return false;
      localStorage.setItem(KEY, serialized);
      return true;
    } catch {
      return false;
    }
  };

  if (tryStore(draft)) return;
  // Too big / quota error — fall back to a text-only draft.
  tryStore({ ...draft, photos: [], photosDropped: true });
}

export function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

export async function dataUrlToFile(photo: DraftPhoto): Promise<File> {
  const res = await fetch(photo.dataUrl);
  const blob = await res.blob();
  return new File([blob], photo.name || "photo", { type: photo.type || blob.type });
}
