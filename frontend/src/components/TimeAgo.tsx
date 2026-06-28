import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/mock";

/**
 * Hydration-safe relative-time label. Renders a stable placeholder until the
 * client has mounted, then shows the relative form.
 */
export function TimeAgo({ iso, className, style }: { iso: string; className?: string; style?: React.CSSProperties }) {
  const [text, setText] = useState<string>(() => placeholder(iso));
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    setText(formatRelativeTime(iso));
    const id = window.setInterval(() => setText(formatRelativeTime(iso)), 60_000);
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
