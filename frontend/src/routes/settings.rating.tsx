import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { Star } from "lucide-react";
import { SettingsSectionShell } from "@/components/settings/SettingsSectionShell";
import { Card } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { mockMyRating, mockMyReviews } from "@/lib/mock";
import { useStore, selectors } from "@/lib/store";
import { isDemoMode } from "@/lib/demo-mode";
import { fetchUserRating, fetchUserReviews } from "@/lib/api/rating";

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

interface ReviewRow {
  id: string;
  author: string;
  avatar?: string;
  rating: number;
  text: string;
  date: string;
}

function RatingSection() {
  const me = useStore(selectors.currentUser);
  // Demo hosts show the illustrative mock; production loads the real
  // aggregate + reviews from GET /users/{id}/rating|reviews.
  const demo = isDemoMode();
  const [rating, setRating] = useState(demo ? mockMyRating : { average: 0, count: 0 });
  const [reviews, setReviews] = useState<ReviewRow[]>(demo ? mockMyReviews : []);

  useEffect(() => {
    if (demo || !me.numericId) return;
    let alive = true;
    Promise.all([fetchUserRating(me.numericId), fetchUserReviews(me.numericId)])
      .then(([agg, rows]) => {
        if (!alive) return;
        setRating(agg);
        setReviews(rows.map((r) => ({
          id: r.id,
          author: r.author.display_name ?? "Пользователь",
          rating: r.rating,
          text: r.text ?? "",
          date: r.date,
        })));
      })
      .catch(() => { /* keep the empty state on failure — never mocks */ });
    return () => { alive = false; };
  }, [demo, me.numericId]);

  return (
    <SettingsSectionShell title="Рейтинг и отзывы">
      <Card className="flex items-center gap-[16px] p-[20px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)", background: "var(--background-surface)" }}>
        <div className="font-display text-[40px] font-bold leading-none" style={{ color: "var(--foreground)" }}>{rating.average.toFixed(1)}</div>
        <div>
          <Stars value={rating.average} size={18} />
          <div className="mt-[4px] text-[13px]" style={{ color: "var(--foreground-50)" }}>на основе {rating.count} отзывов</div>
        </div>
      </Card>

      <div className="flex flex-col gap-[10px]">
        {reviews.length === 0 && !demo ? (
          <Card className="p-[16px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
            <p className="text-[13.5px]" style={{ color: "var(--foreground-50)" }}>Отзывов пока нет</p>
          </Card>
        ) : (
        reviews.map((r) => (
          <Card key={r.id} className="flex items-start gap-[12px] p-[16px]" style={{ borderColor: "var(--border)", borderRadius: "var(--r-card)" }}>
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
        ))
        )}
      </div>
    </SettingsSectionShell>
  );
}
