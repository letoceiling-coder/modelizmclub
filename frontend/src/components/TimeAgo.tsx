import { useEffect, useState } from "react";
import { formatRelativeTime } from "@/lib/utils/time";

/**
 * Hydration-safe relative-time label. Renders the absolute timestamp on the
 * server and during the first client render, then swaps to the relative form
 * after hydration to avoid SSR/client text mismatches.
 */
export function TimeAgo({ iso, className, style }: { iso: string; className?: string; style?: React.CSSProperties }) {
  const [text, setText] = useState<string>(() => fallback(iso));

  useEffect(() => {
    setText(formatRelativeTime(iso));
    const id = window.setInterval(() => setText(formatRelativeTime(iso)), 60_000);
    return () => window.clearInterval(id);
  }, [iso]);

  return (
    <span className={className} style={style} suppressHydrationWarning>
      {text}
    </span>
  );
}

function fallback(iso: string): string {
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return iso;
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(t.getUTCHours())}:${pad(t.getUTCMinutes())}`;
}
