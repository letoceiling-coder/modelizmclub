import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { Play, Eye } from "lucide-react";
import type { Video } from "@/lib/mock";
import { categoryPlaceholder } from "@/lib/placeholder-image";
import { formatDuration } from "@/lib/format-duration";
import { cn } from "@/lib/utils";

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString("ru", { day: "numeric", month: "short" });
}

function shortViews(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(".0", "")} тыс.`;
  return String(n);
}

export function VideoCard({ video, className }: { video: Video; className?: string }) {
  const initial = video.posterUrl || categoryPlaceholder(video.id, "");
  const [src, setSrc] = useState(initial);

  return (
    <Link
      to="/reviews/$id"
      params={{ id: video.id }}
      className={cn("group flex flex-col", className)}
    >
      <div
        className="relative overflow-hidden"
        style={{ aspectRatio: "16 / 9", background: "var(--background-surface)", borderRadius: "var(--r-card)" }}
      >
        <img
          src={src}
          alt={video.title}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          onError={() => {
            const ph = categoryPlaceholder(video.id, "");
            if (src !== ph) setSrc(ph);
          }}
        />
        {/* play overlay */}
        <div className="absolute inset-0 grid place-items-center opacity-0 transition-opacity group-hover:opacity-100">
          <span className="grid h-[44px] w-[44px] place-items-center rounded-full" style={{ background: "rgba(0,0,0,0.6)" }}>
            <Play size={20} fill="#fff" color="#fff" />
          </span>
        </div>
        {/* duration badge */}
        <span
          className="absolute bottom-[6px] right-[6px] rounded-[4px] px-[6px] py-[2px] text-[11px] font-semibold"
          style={{ background: "rgba(0,0,0,0.78)", color: "#fff" }}
        >
          {formatDuration(video.durationSeconds)}
        </span>
      </div>
      <div className="mt-[8px] flex flex-col gap-[4px]">
        <h3 className="line-clamp-2 text-[13.5px] font-medium leading-[1.35]" style={{ color: "var(--foreground)" }}>
          {video.title}
        </h3>
        <div className="flex items-center gap-[8px] text-[11.5px]" style={{ color: "var(--foreground-50)" }}>
          <span className="inline-flex items-center gap-[4px]"><Eye size={12} /> {shortViews(video.views)}</span>
          {video.publishedAt && <span>· {shortDate(video.publishedAt)}</span>}
        </div>
      </div>
    </Link>
  );
}
