import type { Category } from "@/lib/mock";

// Детерминированный «онлайн» по id категории — без бэка, но стабильно
// от рендера к рендеру. Общий источник для правых панелей и мобильного шита.
export function onlineFor(c: Category): number {
  const seed = c.id.split("").reduce((a, ch) => a + ch.charCodeAt(0), 0);
  const base = Math.max(3, Math.round(c.members * 0.012));
  return base + (seed % 17);
}
