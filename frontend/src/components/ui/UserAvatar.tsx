import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  return (parts[0][0] + (parts[1]?.[0] ?? "")).toUpperCase();
}

interface Props {
  /** null допускается: у части моделей аватар приходит как null, а не отсутствует. */
  src?: string | null;
  name: string;
  /** Square size in px. */
  size?: number;
  online?: boolean;
  className?: string;
}

/**
 * Единственный аватар в приложении. Построен на общем Radix Avatar, а тот
 * запрашивает вариант `thumb`: до 05.09 два десятка мест рисовали сырой
 * <img> с оригиналом — на первом экране ленты это давало 412 КБ PNG 480×480
 * в кружок 32 пикселя. Жил в messenger/UserAvatar, хотя его уже импортировали
 * лента и каналы; переехал сюда, чтобы не заводить второй. Falls back to accent-soft
 * initials when the image is missing or fails to load — never renders
 * `<img src="">` or a broken-image glyph. Optional online dot overlay.
 */
export function UserAvatar({ src, name, size = 48, online, className }: Props) {
  const hasSrc = Boolean(src && src.trim());
  const dot = Math.max(10, Math.round(size * 0.25));

  return (
    <span className="relative inline-flex shrink-0" style={{ width: size, height: size }}>
      <Avatar className={cn("h-full w-full", className)}>
        {hasSrc && <AvatarImage src={src ?? undefined} alt="" />}
        <AvatarFallback
          className="font-display font-semibold"
          style={{
            background: "var(--accent-soft)",
            color: "var(--accent)",
            fontSize: Math.round(size * 0.36),
          }}
        >
          {initials(name)}
        </AvatarFallback>
      </Avatar>
      {online && (
        <span
          className="absolute bottom-0 right-0 rounded-full"
          style={{
            width: dot,
            height: dot,
            background: "var(--success)",
            border: "2px solid var(--background-elevated)",
          }}
        />
      )}
    </span>
  );
}
