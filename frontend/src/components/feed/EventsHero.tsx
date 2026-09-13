import { useEffect, useMemo, useRef, useState } from "react";
import { MediaArrow } from "@/components/ui/MediaArrow";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { CalendarDays, Check, MapPin, Users, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { attendeesLabel } from "@/components/events/EventCard";
import { eventDateParts } from "@/components/events/event-format";
import { useEventAttendance } from "@/components/events/useEventAttendance";
import { fetchEvent, type ClubEvent } from "@/lib/api/events";
import type { Banner } from "@/lib/mock";
import {
  fetchBannersWithSettings,
  getCachedBannersWithSettings,
  recordBannerEvent,
  type BannerPack,
} from "@/lib/api/banners";
import { ReducedMotionSwitch } from "@/components/ui/reduced-motion-switch";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { BannerHeroSlide, BANNER_HERO_HEIGHT } from "@/components/feed/BannerHeroSlide";
import { TAP_TARGET_44 } from "@/lib/tap-target";
import { cn } from "@/lib/utils";
import { reportReadFailure } from "@/lib/errors/handle";

/** Ключ, под которым лежат закрытые пользователем баннеры. */
const DISMISSED_KEY = "mc_feed_hero_dismissed";

function readDismissed(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const list: unknown = raw ? JSON.parse(raw) : [];
    return Array.isArray(list) ? list.filter((x): x is string => typeof x === "string") : [];
  } catch {
    return [];
  }
}

function rememberDismissed(id: string) {
  if (typeof window === "undefined") return;
  try {
    const next = Array.from(new Set([...readDismissed(), id])).slice(-50);
    window.localStorage.setItem(DISMISSED_KEY, JSON.stringify(next));
  } catch {
    /* приватный режим — закрытие живёт до перезагрузки */
  }
}

export function sortBanners(list: Banner[]): Banner[] {
  return [...list].sort((a, b) => {
    if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    return (b.priority ?? 0) - (a.priority ?? 0);
  });
}

/**
 * @param initial баннеры, уже полученные лоадером маршрута. Без них компонент
 *   узнаёт о картинке только после гидрации, и на /feed это давало LCP 7,7 с
 *   при FCP 1,0 с: пять секунд браузер просто не знал, что грузить.
 */
export function EventsHero({ initial }: { initial?: BannerPack | null }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { guardAction } = useGuestAccess();
  const cached = initial ?? getCachedBannersWithSettings();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [allBanners, setAllBanners] = useState<Banner[]>(() => cached?.banners ?? []);
  const [autoplayMs, setAutoplayMs] = useState(() =>
    Math.max(3000, (cached?.carousel.autoplay_seconds ?? 10) * 1000),
  );
  const [enabled, setEnabled] = useState(() => cached?.carousel.enabled !== false);
  const [signup, setSignup] = useState<Banner | null>(null);
  // Закрытые баннеры читаются после монтирования, а не при первом рендере:
  // на сервере localStorage нет, и решение, принятое только в браузере,
  // разошлось бы с серверной разметкой. Расплата — у того, кто уже закрыл
  // баннер, блок исчезает первым же кадром после гидрации; у всех
  // остальных первый экран не двигается.
  const [dismissed, setDismissed] = useState<string[]>([]);
  useEffect(() => {
    const stored = readDismissed();
    if (stored.length > 0) setDismissed(stored);
  }, []);
  // False only during the very first fetch. Until then the hero's box is
  // reserved (see below): rendering null and then inserting a 200px slider
  // above the feed was the single largest layout shift on /feed (CLS 0.25).
  const [settled, setSettled] = useState(() => cached !== null);
  useEffect(() => {
    if (cached) return;
    let active = true;
    fetchBannersWithSettings()
      .then(({ banners, carousel }) => {
        if (!active) return;
        setAllBanners(banners);
        setAutoplayMs(Math.max(3000, (carousel.autoplay_seconds ?? 10) * 1000));
        setEnabled(carousel.enabled !== false);
      })
      .catch((e) => reportReadFailure(e, "ближайшие события"))
      .finally(() => {
        if (active) setSettled(true);
      });
    return () => {
      active = false;
    };
  }, [cached]);

  const list = useMemo(
    () => sortBanners(allBanners.filter((b) => b.active !== false && !dismissed.includes(b.id))),
    [allBanners, dismissed],
  );

  useEffect(() => {
    if (list.length <= 1 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % list.length), autoplayMs);
    return () => clearInterval(id);
  }, [list.length, paused, autoplayMs]);

  useEffect(() => {
    if (index >= list.length) setIndex(0);
  }, [index, list.length]);

  useEffect(() => {
    const current = list[index];
    if (!current) return;
    void recordBannerEvent(current.id, "impression");
  }, [index, list]);

  const dragStart = useRef<{ x: number; y: number } | null>(null);

  if (!settled) {
    return (
      <section
        aria-hidden
        className="relative overflow-hidden rounded-[16px] border"
        style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
      >
        <div
          className={`animate-pulse ${BANNER_HERO_HEIGHT}`}
          style={{ background: "var(--background-surface)" }}
        />
      </section>
    );
  }
  if (!enabled || list.length === 0) return null;

  const current = list[index];

  const prev = () => setIndex((i) => (i - 1 + list.length) % list.length);
  const next = () => setIndex((i) => (i + 1) % list.length);
  /** Закрыть текущий баннер: он уходит из ленты и не возвращается после
   *  перезагрузки, пока администратор не поставит новый. */
  const dismissCurrent = () => {
    rememberDismissed(current.id);
    setDismissed((prev) => [...prev, current.id]);
    setIndex(0);
  };

  const onSlidePointerDown = (e: React.PointerEvent) => {
    dragStart.current = { x: e.clientX, y: e.clientY };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onSlidePointerUp = (e: React.PointerEvent) => {
    const start = dragStart.current;
    dragStart.current = null;
    if (start === null || list.length <= 1) return;
    const dx = e.clientX - start.x;
    const dy = e.clientY - start.y;
    if (Math.abs(dy) > Math.abs(dx)) return;
    const SWIPE_THRESHOLD = 40;
    if (Math.abs(dx) > SWIPE_THRESHOLD) {
      if (dx < 0) next();
      else prev();
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const tapX = e.clientX - rect.left;
    if (tapX < rect.width / 2) prev();
    else next();
  };
  const stopPointerPropagation = {
    onPointerDown: (e: React.PointerEvent) => e.stopPropagation(),
    onPointerUp: (e: React.PointerEvent) => e.stopPropagation(),
  };
  const openCta = (b: Banner) => {
    guardAction("feed.banner.navigate", () => {
      void recordBannerEvent(b.id, "click");
      // Баннер события площадки регистрирует прямо здесь, ссылка не нужна.
      if (b.event) {
        setSignup(b);
        return;
      }
      const link = b.link?.trim();
      if (link && /^https?:\/\//i.test(link)) {
        window.open(link, "_blank", "noopener,noreferrer");
        return;
      }
      if (link) {
        void navigate({ to: link });
        return;
      }
      setSignup(b);
    });
  };
  return (
    <>
      <section
        aria-label={t("components.eventsHero.ariaLabel")}
        className="relative overflow-hidden rounded-[16px] border"
        style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
      >
        <div
          className={`relative cursor-pointer ${BANNER_HERO_HEIGHT}`}
          style={{ touchAction: "pan-y" }}
          onPointerDown={onSlidePointerDown}
          onPointerUp={onSlidePointerUp}
        >
          <ReducedMotionSwitch
            switchKey={current.id}
            animateOnMount={false}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="relative block h-full w-full"
          >
            <BannerHeroSlide
              banner={current}
              priority={index === 0}
              onCtaClick={() => openCta(current)}
              ctaPointerProps={stopPointerPropagation}
            />
          </ReducedMotionSwitch>

          <button
            type="button"
            onClick={dismissCurrent}
            {...stopPointerPropagation}
            aria-label={t("components.eventsHero.dismiss")}
            className={cn(
              TAP_TARGET_44,
              "absolute right-[8px] top-[8px] grid h-[28px] w-[28px] place-items-center rounded-full text-white",
            )}
            style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
          >
            <X className="h-[15px] w-[15px]" />
          </button>

          {list.length > 1 && (
            <>
              <MediaArrow
                direction="prev"
                label={t("components.eventsHero.prev")}
                className="absolute left-[10px] top-1/2 hidden -translate-y-1/2 sm:grid"
                onClick={prev}
                {...stopPointerPropagation}
              />
              <MediaArrow
                direction="next"
                label={t("components.eventsHero.next")}
                className="absolute right-[10px] top-1/2 hidden -translate-y-1/2 sm:grid"
                onClick={next}
                {...stopPointerPropagation}
              />
            </>
          )}
        </div>

        {list.length > 1 && (
          <div className="flex items-center justify-center gap-[6px] py-[10px]">
            {list.map((b, i) => {
              const active = i === index;
              return (
                <button
                  key={b.id}
                  aria-label={`Перейти к баннеру ${i + 1}`}
                  onClick={() => setIndex(i)}
                  className="rounded-full transition"
                  style={{
                    width: active ? 20 : 6,
                    height: 6,
                    background: active
                      ? "var(--accent)"
                      : "var(--foreground-30, color-mix(in oklab, var(--foreground) 25%, transparent))",
                  }}
                />
              );
            })}
          </div>
        )}
      </section>

      <EventSignupModal banner={signup} onClose={() => setSignup(null)} />
    </>
  );
}

/**
 * Регистрация на событие площадки из баннера.
 *
 * Данные баннера — только витрина: отметка «иду», число участников и право
 * отметиться берутся из самого события, поэтому окно спрашивает его при
 * открытии. Без привязанного события окно не открывается вовсе — такой
 * баннер ведёт по своей ссылке.
 */
function EventSignupModal({ banner, onClose }: { banner: Banner | null; onClose: () => void }) {
  const navigate = useNavigate();
  const [event, setEvent] = useState<ClubEvent | null>(null);
  const [failed, setFailed] = useState(false);
  const uuid = banner?.event?.uuid ?? null;
  const { toggle, busyUuid } = useEventAttendance(setEvent);

  useEffect(() => {
    setEvent(null);
    setFailed(false);
    if (!uuid) return;
    let alive = true;
    fetchEvent(uuid)
      .then((e) => alive && setEvent(e))
      .catch(() => alive && setFailed(true));
    return () => {
      alive = false;
    };
  }, [uuid]);

  const preview = banner?.event;
  const when = preview?.startsAt ? eventDateParts(event?.startsAt ?? preview.startsAt).full : "";
  const canAttend = event ? event.going || event.can.attend : false;

  return (
    <Dialog open={Boolean(banner && preview)} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle>Регистрация на мероприятие</DialogTitle>
          <DialogDescription>{event?.title ?? preview?.title ?? banner?.title}</DialogDescription>
        </DialogHeader>
        <dl className="mt-1.5 flex flex-col gap-2 text-[14px]">
          {when && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Когда</dt>
              <CalendarDays
                className="mt-0.5 h-[16px] w-[16px] shrink-0"
                style={{ color: "var(--foreground-50)" }}
                aria-hidden
              />
              <dd style={{ color: "var(--foreground)" }}>{when}</dd>
            </div>
          )}
          {(event?.locationName ?? preview?.locationName) && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Где</dt>
              <MapPin
                className="mt-0.5 h-[16px] w-[16px] shrink-0"
                style={{ color: "var(--foreground-50)" }}
                aria-hidden
              />
              <dd style={{ color: "var(--foreground)" }}>
                {event?.locationName ?? preview?.locationName}
              </dd>
            </div>
          )}
          {event && (
            <div className="flex items-start gap-2">
              <dt className="sr-only">Участники</dt>
              <Users
                className="mt-0.5 h-[16px] w-[16px] shrink-0"
                style={{ color: "var(--foreground-50)" }}
                aria-hidden
              />
              <dd style={{ color: "var(--foreground)" }}>{attendeesLabel(event.attendeesCount)}</dd>
            </div>
          )}
        </dl>

        {failed && (
          <p role="alert" className="mt-2.5 text-[13px]" style={{ color: "var(--error, #dc2626)" }}>
            Не удалось загрузить мероприятие. Попробуйте позже.
          </p>
        )}
        {event && !canAttend && (
          <p className="mt-2.5 text-[13px]" style={{ color: "var(--foreground-50)" }}>
            {event.displayStatus === "cancelled"
              ? "Мероприятие отменено."
              : event.displayStatus === "past"
                ? "Мероприятие уже прошло."
                : "На это мероприятие сейчас нельзя отметиться."}
          </p>
        )}

        <div className="mt-4 flex flex-col gap-2 sm:flex-row-reverse">
          {event && canAttend && (
            <Button
              type="button"
              className="flex-1 gap-1.5"
              variant={event.going ? "outline" : "default"}
              disabled={busyUuid === event.uuid}
              aria-pressed={event.going}
              onClick={() => toggle(event)}
            >
              {event.going && <Check className="h-[15px] w-[15px]" aria-hidden />}
              {event.going ? "Вы идёте — отменить" : "Пойду"}
            </Button>
          )}
          {!event && !failed && (
            <Button type="button" className="flex-1" disabled>
              Загружаем…
            </Button>
          )}
          {uuid && (
            <Button
              type="button"
              variant="outline"
              className="flex-1"
              onClick={() => {
                onClose();
                void navigate({ to: "/events/$uuid", params: { uuid } });
              }}
            >
              Подробнее
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
