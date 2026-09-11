import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format/date";
import { useHydrated } from "@/hooks/use-hydrated";

/**
 * Hydration-safe relative-time label. Renders a stable placeholder while the
 * server markup is being hydrated, then shows the relative form.
 *
 * Метка, смонтированная уже в работающем приложении (сообщение, пришедшее
 * после загрузки, новая страница ленты), сразу показывает окончательный
 * текст. До 11.09 заглушка «17:14» стояла первым кадром у всех: пузырь
 * мессенджера рос с 73 до 131 px, а свои пузыри прижаты вправо — они
 * уезжали влево на 58 px (CLS 0,001–0,003 на каждом переходе в мессенджер).
 */
export function TimeAgo({
  iso,
  className,
  style,
}: {
  iso: string;
  className?: string;
  style?: React.CSSProperties;
}) {
  const hydrated = useHydrated();
  const [text, setText] = useState<string>(() => formatDate(iso, "relative"));

  useEffect(() => {
    setText(formatDate(iso, "relative"));
    const id = window.setInterval(() => setText(formatDate(iso, "relative")), 60_000);
    return () => window.clearInterval(id);
  }, [iso]);

  return (
    <span className={className} style={style} suppressHydrationWarning>
      {hydrated ? text : placeholder(iso)}
    </span>
  );
}

function placeholder(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(t.getHours())}:${pad(t.getMinutes())}`;
}
