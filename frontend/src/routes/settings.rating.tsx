import { createFileRoute } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { mockMyRating, mockMyReviews } from "@/lib/mock";

export const Route = createFileRoute("/settings/rating")({
  component: RatingSection,
});

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="inline-flex items-center gap-[2px]">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star key={n} size={size} fill={n <= Math.round(value) ? "var(--accent)" : "none"} style={{ color: "var(--accent)" }} />
      ))}
    </span>
  );
}

function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? "") + (p[1]?.[0] ?? "")).toUpperCase();
}

function RatingSection() {
  return (
    <SettingsSectionShell title="Рейтинг и отзывы">
      <Card className="flex items-center gap-[16px] p-[20px]" style={{ borderColor: "var(--border)", borderRadius: 14, background: "var(--background-surface)" }}>
        <div className="font-display text-[40px] font-bold leading-none" style={{ color: "var(--foreground)" }}>{mockMyRating.average.toFixed(1)}</div>
        <div>
          <Stars value={mockMyRating.average} size={18} />
          <div className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-50)" }}>на основе {mockMyRating.count} отзывов</div>
        </div>
      </Card>

      <div className="flex flex-col gap-[10px]">
        {mockMyReviews.map((r) => (
          <Card key={r.id} className="flex items-start gap-[12px] p-[16px]" style={{ borderColor: "var(--border)", borderRadius: 14 }}>
            <Avatar className="h-[40px] w-[40px] shrink-0">
              <AvatarImage src={r.avatar} alt="" />
              <AvatarFallback className="text-[13px] font-semibold" style={{ background: "var(--accent-soft)", color: "var(--accent)" }}>{initials(r.author)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1">
              <div className="flex items-center justify-between gap-[8px]">
                <span className="truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{r.author}</span>
                <Stars value={r.rating} />
              </div>
              <p className="mt-[4px] text-[13.5px] leading-[1.5]" style={{ color: "var(--foreground-90)" }}>{r.text}</p>
              <div className="mt-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
                {new Date(r.date).toLocaleDateString("ru-RU", { day: "numeric", month: "long", year: "numeric" })}
              </div>
            </div>
          </Card>
        ))}
      </div>
    </SettingsSectionShell>
  );
}
