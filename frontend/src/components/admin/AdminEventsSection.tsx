import { useCallback, useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Ban,
  CalendarDays,
  ExternalLink,
  Megaphone,
  Pencil,
  Plus,
  Trash2,
  Users,
} from "lucide-react";
import { H, card, inputStyle } from "@/components/admin/adminShared";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { EmptyState } from "@/components/ui/empty-state";
import { EventFormDialog } from "@/components/events/EventFormDialog";
import { attendeesLabel } from "@/components/events/EventCard";
import { eventDateParts, eventStatusLabel } from "@/components/events/event-format";
import {
  adminCancelEvent,
  adminCreateEvent,
  adminDeleteEvent,
  adminFetchEventAttendees,
  adminFetchEvents,
  adminUpdateEvent,
  eventErrors,
  type AdminEventStatusFilter,
  type ClubEvent,
  type EventAttendee,
  type EventScope,
} from "@/lib/api/events";
import { fetchAdminBanners, updateAdminBanner, type AdminBannerRow } from "@/lib/api/admin";
import { askConfirm, askText } from "@/lib/ui/ask";
import { toast } from "@/lib/toast";

const STATUS_OPTIONS: { value: AdminEventStatusFilter; label: string }[] = [
  { value: "", label: "Все, кроме удалённых" },
  { value: "upcoming", label: "Предстоящие" },
  { value: "past", label: "Прошедшие" },
  { value: "draft", label: "Черновики" },
  { value: "published", label: "Опубликованные" },
  { value: "cancelled", label: "Отменённые" },
  { value: "deleted", label: "Удалённые" },
];

/**
 * «Мероприятия» в админке: все события площадки и сообществ.
 *
 * Каждое изменяющее действие идёт через /admin/events и пишется в аудит на
 * сервере (admin.events.*). Событие площадки создаётся здесь же — поле
 * «Сообщество» пустое. Привязка к баннеру ленты — отсюда, чтобы не искать
 * uuid события в карточке баннеров.
 */
export function AdminEventsSection() {
  const [scope, setScope] = useState<"" | EventScope>("");
  const [status, setStatus] = useState<AdminEventStatusFilter>("");
  const [community, setCommunity] = useState("");
  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<ClubEvent[]>([]);
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 });
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState("");
  const [createOpen, setCreateOpen] = useState(false);
  const [createCommunity, setCreateCommunity] = useState("");
  const [editing, setEditing] = useState<ClubEvent | null>(null);
  const [attendeesOf, setAttendeesOf] = useState<ClubEvent | null>(null);
  const [bannerOf, setBannerOf] = useState<ClubEvent | null>(null);

  const load = useCallback(() => {
    setLoading(true);
    setFailed("");
    adminFetchEvents({ scope, status, community, q, page })
      .then((res) => {
        setRows(res.items);
        setMeta({ total: res.total, lastPage: res.lastPage });
      })
      .catch((e) => setFailed(eventErrors(e).message))
      .finally(() => setLoading(false));
  }, [scope, status, community, q, page]);

  useEffect(() => {
    const id = setTimeout(load, 250);
    return () => clearTimeout(id);
  }, [load]);

  const replace = (next: ClubEvent) =>
    setRows((list) => list.map((r) => (r.uuid === next.uuid ? next : r)));

  const onCancel = async (event: ClubEvent) => {
    const reason = await askText({
      title: "Отменить мероприятие?",
      description: "Отметившиеся получат уведомление с причиной.",
      placeholder: "Причина (необязательно)",
      confirmLabel: "Отменить мероприятие",
    });
    if (reason === null) return;
    try {
      replace(await adminCancelEvent(event.uuid, reason));
      toast.success("Мероприятие отменено");
    } catch (e) {
      toast.error(eventErrors(e).message);
    }
  };

  const onDelete = async (event: ClubEvent) => {
    const ok = await askConfirm({
      title: `Удалить «${event.title}»?`,
      description:
        "Предстоящее опубликованное сначала отменяется — отметившиеся получат уведомление.",
      confirmLabel: "Удалить",
      danger: true,
    });
    if (!ok) return;
    try {
      await adminDeleteEvent(event.uuid);
      toast.success("Мероприятие удалено");
      load();
    } catch (e) {
      toast.error(eventErrors(e).message);
    }
  };

  const selectStyle = { ...inputStyle, width: "100%" };

  return (
    <div>
      <H
        action={
          <Button type="button" onClick={() => setCreateOpen(true)} className="gap-1.5">
            <Plus size={16} aria-hidden /> Событие площадки
          </Button>
        }
      >
        Мероприятия
      </H>

      <div className="mb-4 grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4" style={card}>
        <label
          className="flex flex-col gap-1 text-[12px]"
          style={{ color: "var(--foreground-50)" }}
        >
          Поиск
          <input
            value={q}
            onChange={(e) => {
              setQ(e.target.value);
              setPage(1);
            }}
            placeholder="Название"
            style={selectStyle}
          />
        </label>
        <label
          className="flex flex-col gap-1 text-[12px]"
          style={{ color: "var(--foreground-50)" }}
        >
          Вид
          <select
            value={scope}
            onChange={(e) => {
              setScope(e.target.value as "" | EventScope);
              setPage(1);
            }}
            style={selectStyle}
          >
            <option value="">Все</option>
            <option value="platform">Площадки</option>
            <option value="community">Сообществ</option>
          </select>
        </label>
        <label
          className="flex flex-col gap-1 text-[12px]"
          style={{ color: "var(--foreground-50)" }}
        >
          Сообщество (адрес)
          <input
            value={community}
            onChange={(e) => {
              setCommunity(e.target.value);
              setPage(1);
            }}
            placeholder="например, rc-krasnodar"
            style={selectStyle}
          />
        </label>
        <label
          className="flex flex-col gap-1 text-[12px]"
          style={{ color: "var(--foreground-50)" }}
        >
          Статус
          <select
            value={status}
            onChange={(e) => {
              setStatus(e.target.value as AdminEventStatusFilter);
              setPage(1);
            }}
            style={selectStyle}
          >
            {STATUS_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="mb-2 text-[13px]" style={{ color: "var(--foreground-50)" }}>
        {loading ? "Загружаем…" : `Найдено: ${meta.total}`}
      </div>

      {failed ? (
        <EmptyState
          icon={CalendarDays}
          title="Не удалось загрузить"
          description={failed}
          variant="compact"
        >
          <Button type="button" variant="outline" size="sm" onClick={load}>
            Повторить
          </Button>
        </EmptyState>
      ) : !loading && rows.length === 0 ? (
        <EmptyState
          icon={CalendarDays}
          title="Мероприятий нет"
          description="Под фильтр ничего не подошло."
          variant="compact"
        />
      ) : (
        <ul className="flex flex-col gap-2">
          {rows.map((event) => (
            <li
              key={event.uuid}
              className="flex flex-col gap-2.5 p-3 md:flex-row md:items-center"
              style={card}
            >
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span
                    className="rounded-full px-2 py-0.25 text-[11px] font-semibold"
                    style={{
                      background:
                        event.scope === "platform"
                          ? "var(--accent-soft)"
                          : "var(--background-surface)",
                      color: event.scope === "platform" ? "var(--accent)" : "var(--foreground-70)",
                    }}
                  >
                    {event.scope === "platform"
                      ? "Площадка"
                      : (event.community?.name ?? "Сообщество")}
                  </span>
                  <span
                    className="text-[11px] font-semibold"
                    style={{ color: "var(--foreground-50)" }}
                  >
                    {event.deletedAt ? "Удалено" : (eventStatusLabel(event) ?? "Опубликовано")}
                  </span>
                </div>
                <div
                  className="mt-1 truncate text-[14px] font-semibold"
                  style={{ color: "var(--foreground)" }}
                >
                  {event.title}
                </div>
                <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                  {eventDateParts(event.startsAt).full}
                  {event.locationName ? ` · ${event.locationName}` : ""} ·{" "}
                  {attendeesLabel(event.attendeesCount)}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {!event.deletedAt && (
                  <Button asChild size="sm" variant="outline" className="gap-1">
                    <Link to="/events/$uuid" params={{ uuid: event.uuid }} target="_blank">
                      <ExternalLink size={14} aria-hidden /> Открыть
                    </Link>
                  </Button>
                )}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className="gap-1"
                  onClick={() => setAttendeesOf(event)}
                >
                  <Users size={14} aria-hidden /> Участники
                </Button>
                {!event.deletedAt && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setEditing(event)}
                  >
                    <Pencil size={14} aria-hidden /> Изменить
                  </Button>
                )}
                {!event.deletedAt && event.scope === "platform" && event.status === "published" && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    onClick={() => setBannerOf(event)}
                  >
                    <Megaphone size={14} aria-hidden /> Баннер
                  </Button>
                )}
                {!event.deletedAt &&
                  event.status !== "cancelled" &&
                  event.displayStatus !== "past" && (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      className="gap-1"
                      onClick={() => void onCancel(event)}
                    >
                      <Ban size={14} aria-hidden /> Отменить
                    </Button>
                  )}
                {!event.deletedAt && (
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    className="gap-1"
                    style={{ color: "var(--error, #dc2626)" }}
                    onClick={() => void onDelete(event)}
                  >
                    <Trash2 size={14} aria-hidden /> Удалить
                  </Button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}

      {meta.lastPage > 1 && (
        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page <= 1}
            onClick={() => setPage((p) => p - 1)}
          >
            Назад
          </Button>
          <span className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
            {page} из {meta.lastPage}
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={page >= meta.lastPage}
            onClick={() => setPage((p) => p + 1)}
          >
            Вперёд
          </Button>
        </div>
      )}

      <EventFormDialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateCommunity("");
        }}
        title={
          createCommunity.trim() ? "Новое мероприятие сообщества" : "Новое мероприятие площадки"
        }
        submit={(input) =>
          adminCreateEvent({ ...input, communitySlug: createCommunity.trim() || null })
        }
        onSaved={() => {
          setPage(1);
          load();
        }}
        extra={
          <label className="flex flex-col gap-1.5 text-[13px]">
            <span className="font-medium" style={{ color: "var(--foreground)" }}>
              Сообщество
            </span>
            <input
              value={createCommunity}
              onChange={(e) => setCreateCommunity(e.target.value)}
              placeholder="Пусто — событие площадки"
              className="h-11 w-full rounded-[10px] border px-3 text-[14px]"
              style={{
                background: "var(--background-surface)",
                borderColor: "var(--border)",
                color: "var(--foreground)",
              }}
            />
            <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
              Адрес сообщества из ссылки /communities/…. Событие площадки получат все пользователи.
            </span>
          </label>
        }
      />

      <EventFormDialog
        open={editing !== null}
        onOpenChange={(open) => !open && setEditing(null)}
        initial={editing}
        title="Изменить мероприятие"
        submit={(input) => adminUpdateEvent(editing!.uuid, input)}
        onSaved={replace}
      />

      <AttendeesDialog event={attendeesOf} onClose={() => setAttendeesOf(null)} />
      <BannerBindDialog event={bannerOf} onClose={() => setBannerOf(null)} />
    </div>
  );
}

function AttendeesDialog({ event, onClose }: { event: ClubEvent | null; onClose: () => void }) {
  const [items, setItems] = useState<EventAttendee[]>([]);
  const [page, setPage] = useState({ page: 1, lastPage: 1, total: 0 });
  const [loading, setLoading] = useState(false);

  const load = useCallback((uuid: string, p: number) => {
    setLoading(true);
    adminFetchEventAttendees(uuid, p)
      .then((res) => {
        setItems((prev) => (p === 1 ? res.items : [...prev, ...res.items]));
        setPage({ page: res.page, lastPage: res.lastPage, total: res.total });
      })
      .catch((e) => toast.error(eventErrors(e).message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    setItems([]);
    if (event) load(event.uuid, 1);
  }, [event, load]);

  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>Участники · {page.total}</DialogTitle>
        </DialogHeader>
        {items.length === 0 ? (
          <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>
            {loading ? "Загружаем…" : "Никто не отметился."}
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {items.map((a) => (
              <li
                key={a.uuid}
                className="truncate text-[14px]"
                style={{ color: "var(--foreground)" }}
              >
                {a.slug ? (
                  <Link
                    to="/user/$id"
                    params={{ id: a.slug }}
                    target="_blank"
                    className="hover:underline"
                  >
                    {a.name}
                  </Link>
                ) : (
                  a.name
                )}
              </li>
            ))}
          </ul>
        )}
        {event && page.page < page.lastPage && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            disabled={loading}
            onClick={() => load(event.uuid, page.page + 1)}
          >
            Показать ещё
          </Button>
        )}
      </DialogContent>
    </Dialog>
  );
}

/** Какой баннер ленты регистрирует на это событие. */
function BannerBindDialog({ event, onClose }: { event: ClubEvent | null; onClose: () => void }) {
  const [banners, setBanners] = useState<AdminBannerRow[]>([]);
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!event) return;
    fetchAdminBanners()
      .then((res) => setBanners(res.banners))
      .catch(() => setBanners([]));
  }, [event]);

  const bind = async (banner: AdminBannerRow, uuid: string | null) => {
    setSaving(banner.id);
    try {
      const saved = await updateAdminBanner(banner.id, { event_uuid: uuid });
      setBanners((list) => list.map((b) => (b.id === saved.id ? saved : b)));
      toast.success(uuid ? "Баннер регистрирует на мероприятие" : "Привязка снята");
    } catch (e) {
      toast.error(eventErrors(e).message);
    } finally {
      setSaving(null);
    }
  };

  return (
    <Dialog open={event !== null} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[80dvh] overflow-y-auto sm:max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Баннер для «{event?.title}»</DialogTitle>
        </DialogHeader>
        <p className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
          Кнопка привязанного баннера открывает регистрацию вместо ссылки. Сам баннер — в разделе
          «Рекламный блок».
        </p>
        {banners.length === 0 ? (
          <p className="text-[14px]" style={{ color: "var(--foreground-50)" }}>
            Баннеров нет.
          </p>
        ) : (
          <ul className="mt-2 flex flex-col gap-1.5">
            {banners.map((b) => {
              const bound = event != null && b.eventUuid === event.uuid;
              return (
                <li
                  key={b.id}
                  className="flex items-center justify-between gap-2 p-2.5"
                  style={card}
                >
                  <div className="min-w-0">
                    <div
                      className="truncate text-[14px] font-medium"
                      style={{ color: "var(--foreground)" }}
                    >
                      {b.title || "Без названия"}
                    </div>
                    <div className="truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>
                      {b.placement}
                      {b.isActive ? "" : " · выключен"}
                      {b.eventTitle && !bound ? ` · привязан к «${b.eventTitle}»` : ""}
                    </div>
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    variant={bound ? "outline" : "default"}
                    disabled={saving === b.id || !event}
                    onClick={() => event && void bind(b, bound ? null : event.uuid)}
                  >
                    {bound ? "Отвязать" : "Привязать"}
                  </Button>
                </li>
              );
            })}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}
