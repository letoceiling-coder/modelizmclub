import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { EventCard } from "@/components/events/EventCard";
import { EventFormDialog } from "@/components/events/EventFormDialog";
import { useEventAttendance } from "@/components/events/useEventAttendance";
import { createCommunityEvent, fetchCommunityEvents, type ClubEvent } from "@/lib/api/events";
import { reportReadFailure } from "@/lib/errors/handle";

const LIMIT = 10;

/**
 * Мероприятия сообщества: предстоящие и прошедшие раздельно.
 *
 * Стоит в двух местах — во вкладке «Мероприятия» и в «Управлении
 * сообществом» (`compact`). Прошедшие грузятся по кнопке: их может быть много,
 * а смотрят их редко.
 */
export function CommunityEventsSection({
  slug,
  canManage,
  compact = false,
  onUpcomingCount,
}: {
  slug: string;
  canManage: boolean;
  compact?: boolean;
  onUpcomingCount?: (count: number) => void;
}) {
  const [upcoming, setUpcoming] = useState<ClubEvent[]>([]);
  const [past, setPast] = useState<ClubEvent[] | null>(null);
  const [pastTotal, setPastTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [formOpen, setFormOpen] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    setFailed(false);
    Promise.all([fetchCommunityEvents(slug, "upcoming", 20), fetchCommunityEvents(slug, "past", 6)])
      .then(([up, done]) => {
        setUpcoming(up.items);
        setPast(done.items);
        setPastTotal(done.total);
        onUpcomingCount?.(up.items.filter((e) => e.status === "published").length);
      })
      .catch((e) => {
        setFailed(true);
        reportReadFailure(e, "мероприятия сообщества");
      })
      .finally(() => setLoading(false));
  }, [slug, onUpcomingCount]);

  useEffect(load, [load]);

  const replace = useCallback((next: ClubEvent) => {
    setUpcoming((list) => list.map((e) => (e.uuid === next.uuid ? next : e)));
    setPast((list) => list?.map((e) => (e.uuid === next.uuid ? next : e)) ?? list);
  }, []);
  const { toggle, busyUuid } = useEventAttendance(replace);

  const loadMorePast = () => {
    fetchCommunityEvents(slug, "past", 50)
      .then((page) => setPast(page.items))
      .catch((e) => reportReadFailure(e, "прошедшие мероприятия"));
  };

  const publishedUpcoming = upcoming.filter((e) => e.status === "published").length;
  const atLimit = publishedUpcoming >= LIMIT;

  const createButton = canManage && (
    <Button type="button" onClick={() => setFormOpen(true)} className="gap-1.5">
      <Plus size={16} aria-hidden /> Создать мероприятие
    </Button>
  );

  const grid = compact ? "grid gap-3 sm:grid-cols-2" : "grid gap-4 sm:grid-cols-2";

  return (
    <div className="flex flex-col gap-4">
      {canManage && (upcoming.length > 0 || (past?.length ?? 0) > 0) && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
            Предстоящих: {publishedUpcoming} из {LIMIT}
          </span>
          {createButton}
        </div>
      )}

      {loading ? (
        <div className={grid}>
          <Skeleton className="aspect-[4/3] w-full rounded-[var(--r-card)]" />
          <Skeleton className="hidden aspect-[4/3] w-full rounded-[var(--r-card)] sm:block" />
        </div>
      ) : failed ? (
        <EmptyState
          icon={CalendarDays}
          title="Не удалось загрузить мероприятия"
          description="Проверьте соединение и попробуйте ещё раз."
          variant="compact"
        >
          <Button type="button" variant="outline" size="sm" onClick={load}>
            Повторить
          </Button>
        </EmptyState>
      ) : upcoming.length === 0 && (past?.length ?? 0) === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Мероприятий пока нет"
          description={
            canManage
              ? "Встреча, выставка, запуск — создайте первое, участники получат уведомление."
              : "Когда организаторы назначат встречу, она появится здесь."
          }
          variant="compact"
        >
          {createButton}
        </EmptyState>
      ) : (
        <>
          <section aria-labelledby={`events-upcoming-${slug}`} className="flex flex-col gap-2.5">
            <h2
              id={`events-upcoming-${slug}`}
              className="font-display text-[12px] font-semibold uppercase tracking-wider"
              style={{ color: "var(--foreground-50)" }}
            >
              Предстоящие
            </h2>
            {upcoming.length > 0 ? (
              <div className={grid}>
                {upcoming.map((e) => (
                  <EventCard key={e.uuid} event={e} onAttend={toggle} busy={busyUuid === e.uuid} />
                ))}
              </div>
            ) : (
              <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>
                Ближайших мероприятий нет.
              </p>
            )}
          </section>

          {past && past.length > 0 && (
            <section aria-labelledby={`events-past-${slug}`} className="flex flex-col gap-2.5">
              <h2
                id={`events-past-${slug}`}
                className="font-display text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--foreground-50)" }}
              >
                Прошедшие
              </h2>
              <div className={grid}>
                {past.map((e) => (
                  <EventCard key={e.uuid} event={e} />
                ))}
              </div>
              {pastTotal > past.length && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="self-start"
                  onClick={loadMorePast}
                >
                  Показать все прошедшие ({pastTotal})
                </Button>
              )}
            </section>
          )}
        </>
      )}

      {canManage && (
        <EventFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          title="Новое мероприятие"
          submit={(input) => createCommunityEvent(slug, input)}
          onSaved={(created) => {
            setUpcoming((list) =>
              [...list, created].sort((a, b) => a.startsAt.localeCompare(b.startsAt)),
            );
            if (created.status === "published") onUpcomingCount?.(publishedUpcoming + 1);
          }}
        />
      )}
      {canManage && atLimit && (
        <p className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
          Достигнут предел в {LIMIT} предстоящих мероприятий — новое можно сохранить черновиком.
        </p>
      )}
    </div>
  );
}
