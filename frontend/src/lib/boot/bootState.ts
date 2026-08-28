let booted = false;

/** False only until the first route has rendered real content. */
export function hasBooted(): boolean {
  return booted;
}

export function markBooted(): void {
  booted = true;
}
