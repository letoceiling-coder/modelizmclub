// Demo subscription state — single source of truth. Real subscription data is backend-track.
export const SUB_DAYS_LEFT = 287;

export function subscriptionEndDate(): string {
  const end = new Date(Date.now() + SUB_DAYS_LEFT * 86400000);
  return end.toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" });
}
