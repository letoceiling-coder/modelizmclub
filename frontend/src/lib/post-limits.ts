/** Matches backend `PostFormRules::TITLE_MAX_LENGTH`. */
export const POST_TITLE_MAX_LENGTH = 100;

export function clampPostTitle(value: string): string {
  return value.slice(0, POST_TITLE_MAX_LENGTH);
}
