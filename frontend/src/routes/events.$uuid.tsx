import { createFileRoute, Link, notFound, useNavigate } from "@tanstack/react-router";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  Ban,
  CalendarDays,
  Check,
  ExternalLink,
  MapPin,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import { AppLayout } from "@/components/layout/AppLayout";
import { RouteErrorState } from "@/components/layout/RouteErrorState";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { EventFormDialog } from "@/components/events/EventFormDialog";
import { attendeesLabel } from "@/components/events/EventCard";
import { eventDateParts, eventStatusLabel } from "@/components/events/event-format";
import { useEventAttendance } from "@/components/events/useEventAttendance";
import { API_ORIGIN, ApiError, getToken } from "@/lib/api/client";
import {
  cancelEvent,
  deleteEvent,
  eventErrors,
  fetchEvent,
  fetchEventAttendees,
  updateEvent,
  type ClubEvent,
  type EventAttendee,
} from "@/lib/api/events";
import { ensurePublicBootstrap } from "@/lib/boot/applyPublicBootstrap";
import { askConfirm } from "@/lib/ui/ask";
import { toast } from "@/lib/toast";
import { ROUTES } from "@/lib/routes";

const SITE_ORIGIN = "https://modelizmclub.ru";

type EventLoaderData = { event: ClubEvent | null };

async function loadEvent({ params }: { params: { uuid: string } }): Promise<EventLoaderData> {
  await ensurePublicBootstrap();
  try {
    return { event: await fetchEvent(params.uuid) };
  } catch (e) {
    // На сервере токена нет: закрытое сообщество и черновик отвечают гостю
    // 404, а участнику — 200. Страница не тупик, клиент спросит с токеном.
    if (e instanceof ApiError && e.status === 404 && !getToken()) throw notFound();
    return { event: null };
  }
}

export const Route = createFileRoute("/events/$uuid")({
  errorComponent: RouteErrorState,
  loader: loadEvent,
  head: ({ loaderData, params }: { loaderData?: EventLoaderData; params: { uuid: string } }) => {
    const event = loaderData?.event ?? null;
    const canonical = `${SITE_ORIGIN}/events/${params.uuid}`;
    const title = event ? `${event.title} — МоДелизМ` : "Мероприятие — МоДелизМ";
    const when = event ? eventDateParts(event.startsAt).full : "";
    const description = event
      ? [when, event.locationName, event.community?.name].filter(Boolean).join(" · ")
      : "Мероприятие на МоДелизМ";
    const image = event?.coverUrl ? new URL(event.coverUrl, API_ORIGIN).href : undefined;
    return {
      meta: [
        { title },
        { name: "description", content: description },
        { property: "og:title", content: title },
        { property: "og:description", content: description },
        { property: "og:type", content: "article" },
        { property: "og:url", content: canonical },
        ...(image ? [{ property: "og:image" as const, content: image }] : []),
      ],
      links: [{ rel: "canonical", href: canonical }],
    };
  },
  component: EventPage,
  notFoundComponent: EventNotFound,
});

function EventPage() {
  const { uuid } = Route.useParams();
  const { event } = Route.useLoaderData();
  return <EventView uuid={uuid} initial={event} />;
}

function EventNotFound() {
  const { uuid } = Route.useParams();
  return <EventView uuid={uuid} initial={null} />;
}

function EventView({ uuid, initial }: { uuid: string; initial: ClubEvent | null }) {
  const navigate = useNavigate();
  const [event, setEvent] = useState<ClubEvent | null>(initial);
  const [missing, setMissing] = useState(false);
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const [editOpen, setEditOpen] = useState(false);
  const [attendees, setAttendees] = useState<EventAttendee[]>([]);
  const [attendeesPage, setAttendeesPage] = useState({ page: 1, lastPage: 1, total: 0 });
  const [attendeesLoading, setAttendeesLoading] = useState(false);

  // Серверная выдача анонимна: у вошедшего права и отметка «иду» другие.
  // Уточняем после монтирования — первый кадр совпадает с серверным.
  useEffect(() => {
    setEvent(initial);
    setMissing(false);
    if (!getToken() && initial) return;
    let alive = true;
    fetchEvent(uuid)
      .then((e) => alive && setEvent(e))
      .catch(() => alive && !initial && setMissing(true));
    return () => {
      alive = false;
    };
  }, [uuid, initial]);

  const loadAttendees = useCallback(
    (page: number) => {
      setAttendeesLoading(true);
      fetchEventAttendees(uuid, page, 30)
        .then((res) => {
          setAttendees((prev) => (page === 1 ? res.items : [...prev, ...res.items]));
          setAttendeesPage({ page: res.page, lastPage: res.lastPage, total: res.total });
        })
        .catch(() => page === 1 && setAttendees([]))
        .finally(() => setAttendeesLoading(false));
    },
    [uuid],
  );

  const attendeesKey = event ? `${event.uuid}:${event.attendeesCount}` : "";
  useEffect(() => {
    if (attendeesKey) loadAttendees(1);
  }, [attendeesKey, loadAttendees]);

  const { toggle, busyUuid } = useEventAttendance(setEvent);

  if (!event) {
    return (
      <AppLayout>
        <div className="py-10">
          {missing || (mounted && !getToken()) ? (
            <EmptyState
              icon={CalendarDays}
              title="Мероприятие не найдено"
              description="Его удалили, или оно в закрытом сообществе."
            >
              <Button asChild>
                <Link to={ROUTES.communities}>К сообществам</Link>
              </Button>
            </EmptyState>
          ) : (
            <div
              className="mx-auto h-[320px] max-w-[720px] animate-pulse rounded-[var(--r-card)]"
              style={{ background: "var(--background-surface)" }}
            />
          )}
        </div>
      </AppLayout>
    );
  }

  const { full } = eventDateParts(event.startsAt);
  const status = eventStatusLabel(event);
  const hasMap = event.latitude != null && event.longitude != null;
  const canAttend = event.going || event.can.attend;

  const onCancel = async () => {
    const ok = await askConfirm({
      title: "Отменить мероприятие?",
      description: "Отметившиеся получат уведомление. Вернуть отменённое нельзя.",
      confirmLabel: "Отменить мероприятие",
      danger: true,
    });
    if (!ok) return;
    try {
      setEvent(await cancelEvent(event.uuid));
      toast.success("Мероприятие отменено");
    } catch (e) {
      toast.error(eventErrors(e).message);
    }
  };

  const onDelete = async () => {
    const ok = await askConfirm({
      title: "Удалить мероприятие?",
      description:
        event.displayStatus === "published"
          ? "Сначала оно будет отменено — отметившиеся получат уведомление."
          : "Мероприятие исчезнет из списков.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await deleteEvent(event.uuid);
      toast.success("Мероприятие удалено");
      if (event.community)
        void navigate({ to: "/communities/$id", params: { id: event.community.slug } });
      else void navigate({ to: ROUTES.feed });
    } catch (e) {
      toast.error(eventErrors(e).message);
    }
  };

  return (
    <AppLayout>
      <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 pb-6">
        {event.community ? (
          <Link
            to="/communities/$id"
            params={{ id: event.community.slug }}
            className="hit-target inline-flex items-center gap-1 self-start text-[13px] hover:opacity-80"
            style={{ color: "var(--foreground-50)" }}
          >
            <ArrowLeft size={14} aria-hidden /> {event.community.name}
          </Link>
        ) : (
          <Link
            to={ROUTES.feed}
            className="hit-target inline-flex items-center gap-1 self-start text-[13px] hover:opacity-80"
            style={{ color: "var(--foreground-50)" }}
          >
            <ArrowLeft size={14} aria-hidden /> Лента
          </Link>
        )}

        <article
          className="overflow-hidden border"
          style={{
            background: "var(--background)",
            borderColor: "var(--border)",
            borderRadius: "var(--r-card)",
          }}
        >
          <div
            className="relative aspect-video w-full"
            style={{ background: "var(--background-surface)" }}
          >
            {event.coverUrl ? (
              <img
                src={event.coverUrl}
                width={1280}
                height={720}
                alt=""
                fetchPriority="high"
                className="h-full w-full object-cover"
              />
            ) : (
              <div
                className="grid h-full w-full place-items-center"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                <CalendarDays size={48} aria-hidden />
              </div>
            )}
            {status && (
              <span
                className="absolute left-[12px] top-[12px] rounded-full px-3 py-1 text-[13px] font-semibold text-white"
                style={{ background: "rgba(0,0,0,0.6)" }}
              >
                {status}
              </span>
            )}
          </div>

          <div className="flex flex-col gap-3.5 p-4 sm:p-6">
            <div>
              <div
                className="text-[12px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--accent)" }}
              >
                {event.scope === "platform" ? "Мероприятие МоДелизМ" : "Мероприятие сообщества"}
              </div>
              <h1
                className="mt-1 font-display text-[22px] font-bold leading-tight sm:text-[26px]"
                style={{ color: "var(--foreground)" }}
              >
                {event.title}
              </h1>
            </div>

            {event.displayStatus === "cancelled" && (
              <div
                role="status"
                className="rounded-[12px] px-3.5 py-2.5 text-[14px]"
                style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}
              >
                Мероприятие отменено{event.cancelReason ? `: ${event.cancelReason}` : "."}
              </div>
            )}

            <dl className="flex flex-col gap-2 text-[14px]">
              <div className="flex items-start gap-2.5">
                <dt className="sr-only">Когда</dt>
                <CalendarDays
                  size={18}
                  className="mt-0.25 shrink-0"
                  style={{ color: "var(--foreground-50)" }}
                  aria-hidden
                />
                <dd style={{ color: "var(--foreground)" }}>{full}</dd>
              </div>
              {event.locationName && (
                <div className="flex items-start gap-2.5">
                  <dt className="sr-only">Где</dt>
                  <MapPin
                    size={18}
                    className="mt-0.25 shrink-0"
                    style={{ color: "var(--foreground-50)" }}
                    aria-hidden
                  />
                  <dd className="min-w-0 break-words" style={{ color: "var(--foreground)" }}>
                    {event.locationName}
                  </dd>
                </div>
              )}
              <div className="flex items-start gap-2.5">
                <dt className="sr-only">Участники</dt>
                <Users
                  size={18}
                  className="mt-0.25 shrink-0"
                  style={{ color: "var(--foreground-50)" }}
                  aria-hidden
                />
                <dd style={{ color: "var(--foreground)" }}>
                  {attendeesLabel(event.attendeesCount)}
                </dd>
              </div>
            </dl>

            <div className="flex flex-wrap items-center gap-2">
              {canAttend && (
                <Button
                  type="button"
                  size="lg"
                  variant={event.going ? "outline" : "default"}
                  disabled={busyUuid === event.uuid}
                  aria-pressed={event.going}
                  onClick={() => toggle(event)}
                  className="gap-2"
                >
                  {event.going ? (
                    <Check size={16} aria-hidden />
                  ) : (
                    <CalendarDays size={16} aria-hidden />
                  )}
                  {event.going ? "Иду — отменить" : "Пойду"}
                </Button>
              )}
              {!canAttend &&
                event.displayStatus === "published" &&
                event.community &&
                !event.community.isOpen && (
                  <span className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
                    Отметиться могут участники сообщества.
                  </span>
                )}
              {event.can.update && event.displayStatus !== "cancelled" && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setEditOpen(true)}
                  className="gap-1.5"
                >
                  <Pencil size={15} aria-hidden /> Изменить
                </Button>
              )}
              {event.can.update &&
                (event.displayStatus === "published" || event.displayStatus === "draft") && (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void onCancel()}
                    className="gap-1.5"
                  >
                    <Ban size={15} aria-hidden /> Отменить
                  </Button>
                )}
              {event.can.delete && (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => void onDelete()}
                  className="gap-1.5"
                  style={{ color: "var(--error, #dc2626)" }}
                >
                  <Trash2 size={15} aria-hidden /> Удалить
                </Button>
              )}
            </div>

            {event.description && (
              <section aria-label="Описание">
                <p
                  className="whitespace-pre-line text-[15px] leading-[1.65]"
                  style={{ color: "var(--foreground-70)" }}
                >
                  {event.description}
                </p>
              </section>
            )}

            {hasMap && (
              <section aria-label="Карта" className="flex flex-col gap-1.5">
                <div
                  className="aspect-[16/9] w-full overflow-hidden rounded-[12px] border sm:aspect-[21/9]"
                  style={{ borderColor: "var(--border)" }}
                >
                  <iframe
                    title={`Карта: ${event.locationName ?? event.title}`}
                    src={osmEmbed(event.latitude as number, event.longitude as number)}
                    className="h-full w-full"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                  />
                </div>
                {event.mapUrl && (
                  <a
                    href={event.mapUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 self-start text-[13px] underline"
                    style={{ color: "var(--foreground-50)" }}
                  >
                    Открыть карту <ExternalLink size={12} aria-hidden />
                  </a>
                )}
              </section>
            )}
          </div>
        </article>

        <section
          aria-labelledby="event-attendees"
          className="border p-4 sm:p-5"
          style={{
            background: "var(--background)",
            borderColor: "var(--border)",
            borderRadius: "var(--r-card)",
          }}
        >
          <h2
            id="event-attendees"
            className="font-display text-[12px] font-semibold uppercase tracking-wider"
            style={{ color: "var(--foreground-50)" }}
          >
            Участники · {attendeesPage.total || event.attendeesCount}
          </h2>
          {attendees.length === 0 ? (
            <p className="mt-2.5 text-[14px]" style={{ color: "var(--foreground-50)" }}>
              {attendeesLoading ? "Загружаем…" : "Пока никто не отметился."}
            </p>
          ) : (
            <ul className="mt-2.5 grid grid-cols-1 gap-2 sm:grid-cols-2">
              {attendees.map((a) => (
                <li key={a.uuid} className="min-w-0">
                  <AttendeeRow a={a} />
                </li>
              ))}
            </ul>
          )}
          {attendeesPage.page < attendeesPage.lastPage && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="mt-3"
              disabled={attendeesLoading}
              onClick={() => loadAttendees(attendeesPage.page + 1)}
            >
              Показать ещё
            </Button>
          )}
        </section>
      </div>

      {event.can.update && (
        <EventFormDialog
          open={editOpen}
          onOpenChange={setEditOpen}
          initial={event}
          title="Изменить мероприятие"
          submit={(input) => updateEvent(event.uuid, input)}
          onSaved={setEvent}
        />
      )}
    </AppLayout>
  );
}

function AttendeeRow({ a }: { a: EventAttendee }) {
  const body = (
    <span className="flex min-w-0 items-center gap-2.5">
      <Avatar className="h-[36px] w-[36px]">
        {a.avatarUrl && <AvatarImage src={a.avatarUrl} alt="" />}
        <AvatarFallback
          className="text-[12px] font-semibold"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {a.name.slice(0, 1).toUpperCase()}
        </AvatarFallback>
      </Avatar>
      <span className="truncate text-[14px]" style={{ color: "var(--foreground)" }}>
        {a.name}
      </span>
    </span>
  );
  return a.slug ? (
    <Link
      to="/user/$id"
      params={{ id: a.slug }}
      className="block rounded-[10px] p-1 hover:opacity-80"
    >
      {body}
    </Link>
  ) : (
    <div className="p-1">{body}</div>
  );
}

function osmEmbed(lat: number, lng: number): string {
  const bbox = [lng - 0.01, lat - 0.006, lng + 0.01, lat + 0.006]
    .map((n) => n.toFixed(5))
    .join("%2C");
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat}%2C${lng}`;
}
