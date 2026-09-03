import { useEffect, useState } from "react";
import { formatDate } from "@/lib/format/date";

/**
 * Hydration-safe relative-time label. Renders a stable placeholder until the
 * client has mounted, then shows the relative form.
 */
export function TimeAgo({ iso, className, style }: { iso: string; className?: string; style?: React.CSSProperties }) {
  const [text, setText] = useState<string>(() => placeholder(iso));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setText(formatDate(iso, "relative"));
    const id = window.setInterval(() => setText(formatDate(iso, "relative")), 60_000);
    return () => window.clearInterval(id);
  }, [iso]);

  return (
    <span className={className} style={style} suppressHydrationWarning>
      {mounted ? text : placeholder(iso)}
    </span>
  );
}

function placeholder(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(t.getHours())}:${pad(t.getMinutes())}`;
}
