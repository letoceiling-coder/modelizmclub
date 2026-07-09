import { createFileRoute } from "@tanstack/react-router";
import { AppLayout } from "@/components/layout/AppLayout";

export const Route = createFileRoute("/reviews/")({
  head: () => ({ meta: [{ title: "Обзоры — МоДелизМ" }] }),
  component: ReviewsPage,
});

function ReviewsPage() {
  return (
    <AppLayout rightColumn={false}>
      <div className="mx-auto max-w-[1100px] py-[40px]">
        <h1 className="font-display text-[28px] font-bold" style={{ color: "var(--foreground)" }}>
          Обзоры
        </h1>
      </div>
    </AppLayout>
  );
}
