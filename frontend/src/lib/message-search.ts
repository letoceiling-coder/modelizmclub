import type { Message } from "@/lib/mock";

export interface MessageSearchFilters {
  dateFrom?: string;
  dateTo?: string;
}

/** All searchable text for a message (body + attachment labels). */
export function getMessageSearchableText(m: Message): string {
  const parts: string[] = [];
  if (m.text?.trim()) parts.push(m.text.trim());
  if (m.file) {
    parts.push(m.file.name);
    parts.push(m.file.kind === "video" ? "видео" : "файл");
  }
  if (m.voice) parts.push("голосовое сообщение");
  if (m.image) parts.push("изображение", "фото");
  if (m.forwardedFrom) parts.push("переслано");
  return parts.join(" ");
}

function dayStart(isoDate: string): number {
  return new Date(`${isoDate}T00:00:00`).getTime();
}

function dayEnd(isoDate: string): number {
  return new Date(`${isoDate}T23:59:59.999`).getTime();
}

export function searchMessages(
  messages: Message[],
  query: string,
  filters: MessageSearchFilters = {},
): Message[] {
  const q = query.trim().toLowerCase();
  const hasDate = Boolean(filters.dateFrom || filters.dateTo);
  if (!q && !hasDate) return [];

  return messages.filter((m) => {
    if (m.deletedForMe) return false;

    if (hasDate) {
      const t = Date.parse(m.time);
      if (Number.isNaN(t)) return false;
      if (filters.dateFrom && t < dayStart(filters.dateFrom)) return false;
      if (filters.dateTo && t > dayEnd(filters.dateTo)) return false;
    }

    if (!q) return true;
    return getMessageSearchableText(m).toLowerCase().includes(q);
  });
}

export function messagePreview(m: Message): string {
  if (m.text?.trim()) return m.text.trim();
  if (m.file) return m.file.kind === "video" ? `Видео: ${m.file.name}` : `Файл: ${m.file.name}`;
  if (m.voice) return "Голосовое сообщение";
  if (m.image) return "Изображение";
  return "Сообщение";
}

export function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export interface TextPart {
  text: string;
  match: boolean;
}

export function splitByQuery(text: string, query: string): TextPart[] {
  const q = query.trim();
  if (!q) return [{ text, match: false }];
  const re = new RegExp(`(${escapeRegExp(q)})`, "gi");
  const parts = text.split(re);
  return parts.filter(Boolean).map((part) => ({
    text: part,
    match: part.toLowerCase() === q.toLowerCase(),
  }));
}
