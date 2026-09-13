import { useState } from "react";
import { Link } from "@tanstack/react-router";
import { CalendarDays, Check, MapPin, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { ClubEvent } from "@/lib/api/events";
import { eventDateParts, eventStatusLabel } from "@/components/events/event-format";

/**
 * Карточка мероприятия: обложка 16:9, дата блоком слева (день крупно, месяц
 * под ним), название, место, число участников и «Пойду».
 *
 * Высота обложки задана соотношением сторон, а не картинкой: пока обложка
 * грузится, карточка уже занимает своё место и список под ней не прыгает.
 */
export function EventCard({
  event,
  onAttend,
  busy = false,
}: {
  event: ClubEvent;
  /** Нет обработчика — нет кнопки (прошедшее, чужое закрытое, превью). */
  onAttend?: (event: ClubEvent) => void;
  busy?: boolean;
}) {
  const [broken, setBroken] = useState(false);
  const { day, month, time } = eventDateParts(event.startsAt);
  const status = eventStatusLabel(event);
  const muted = event.displayStatus === "past" || event.displayStatus === "cancelled";
  const canPress = Boolean(onAttend) && (event.going || event.can.attend);

  return (
    <article
      className="flex flex-col overflow-hidden border"
      style={{
        background: "var(--background)",
        borderColor: "var(--border)",
        borderRadius: "var(--r-card)",
      }}
    >
      <Link
        to="/events/$uuid"
        params={{ uuid: event.uuid }}
        className="relative block aspect-video w-full overflow-hidden"
        style={{ background: "var(--background-surface)" }}
        aria-label={event.title}
      >
        {event.coverUrl && !broken ? (
          <img
            src={event.coverUrl}
            width={1280}
            height={720}
            alt=""
            loading="lazy"
            decoding="async"
            className="h-full w-full object-cover"
            style={muted ? { filter: "grayscale(0.6)" } : undefined}
            onError={() => setBroken(true)}
          />
        ) : (
          <div
            className="grid h-full w-full place-items-center"
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <CalendarDays size={32} aria-hidden />
          </div>
        )}
        {status && (
          <span
            className="absolute left-[10px] top-[10px] rounded-full px-2.5 py-0.75 text-[12px] font-semibold text-white"
            style={{ background: "rgba(0,0,0,0.6)" }}
          >
            {status}
          </span>
        )}
      </Link>

      <div className="flex flex-1 gap-3 p-3.5">
        <div
          className="flex h-[56px] w-[52px] shrink-0 flex-col items-center justify-center rounded-[12px]"
          style={{
            background: muted ? "var(--background-surface)" : "var(--accent-soft)",
            color: muted ? "var(--foreground-50)" : "var(--accent)",
          }}
          aria-hidden
        >
          <span className="font-display text-[22px] font-bold leading-none">{day}</span>
          <span className="mt-0.75 text-[11px] font-semibold uppercase leading-none">{month}</span>
        </div>

        <div className="flex min-w-0 flex-1 flex-col">
          <Link
            to="/events/$uuid"
            params={{ uuid: event.uuid }}
            className="line-clamp-2 font-display text-[15px] font-semibold leading-snug hover:underline"
            style={{ color: "var(--foreground)" }}
          >
            {event.title}
          </Link>
          <div className="mt-1 text-[13px]" style={{ color: "var(--foreground-50)" }}>
            {time}
          </div>
          {event.locationName && (
            <div
              className="mt-0.5 flex min-w-0 items-center gap-1 text-[13px]"
              style={{ color: "var(--foreground-50)" }}
            >
              <MapPin size={13} className="shrink-0" aria-hidden />
              <span className="truncate">{event.locationName}</span>
            </div>
          )}

          <div className="mt-auto flex items-center justify-between gap-2 pt-2.5">
            <span
              className="inline-flex items-center gap-1 text-[13px]"
              style={{ color: "var(--foreground-50)" }}
            >
              <Users size={13} aria-hidden />
              {attendeesLabel(event.attendeesCount)}
            </span>
            {canPress && onAttend && (
              <Button
                type="button"
                size="sm"
                variant={event.going ? "outline" : "default"}
                disabled={busy}
                onClick={() => onAttend(event)}
                aria-pressed={event.going}
                className="shrink-0 gap-1.5"
              >
                {event.going && <Check size={14} aria-hidden />}
                {event.going ? "Иду" : "Пойду"}
              </Button>
            )}
          </div>
        </div>
      </div>
    </article>
  );
}

export function attendeesLabel(count: number): string {
  if (count === 0) return "Пока никто";
  const word = count % 10 === 1 && count % 100 !== 11 ? "идёт" : "идут";
  return `${count} ${word}`;
}
