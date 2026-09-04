import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CalendarDays } from "lucide-react";
import type { Banner } from "@/lib/mock";
import {
  fetchBannersWithSettings,
  getCachedBannersWithSettings,
  recordBannerEvent,
} from "@/lib/api/banners";
import { ReducedMotionSwitch } from "@/components/ui/reduced-motion-switch";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import { BannerHeroSlide, BANNER_HERO_HEIGHT } from "@/components/feed/BannerHeroSlide";

function sortBanners(list: Banner[]): Banner[] {
  return [...list].sort((a, b) => {
    if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    return (b.priority ?? 0) - (a.priority ?? 0);
  });
}

export function EventsHero() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { guardAction } = useGuestAccess();
  const cached = getCachedBannersWithSettings();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [allBanners, setAllBanners] = useState<Banner[]>(() => cached?.banners ?? []);
  const [autoplayMs, setAutoplayMs] = useState(() =>
    Math.max(3000, (cached?.carousel.autoplay_seconds ?? 10) * 1000),
  );
  const [enabled, setEnabled] = useState(() => cached?.carousel.enabled !== false);
  const [signup, setSignup] = useState<Banner | null>(null);
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
      .catch(() => {})
      .finally(() => {
        if (active) setSettled(true);
      });
    return () => {
      active = false;
    };
  }, [cached]);

  const list = useMemo(
    () => sortBanners(allBanners.filter((b) => b.active !== false)),
    [allBanners],
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

          {list.length > 1 && (
            <>
              <button
                onClick={prev}
                {...stopPointerPropagation}
                aria-label={t("components.eventsHero.prev")}
                className="absolute left-[10px] top-1/2 hidden -translate-y-1/2 place-items-center rounded-full text-white sm:grid h-[32px] w-[32px]"
                style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)" }}
              >
                <ChevronLeft className="h-[16px] w-[16px]" />
              </button>
              <button
                onClick={next}
                {...stopPointerPropagation}
                aria-label={t("components.eventsHero.next")}
                className="absolute right-[10px] top-1/2 hidden -translate-y-1/2 place-items-center rounded-full text-white sm:grid h-[32px] w-[32px]"
                style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)" }}
              >
                <ChevronRight className="h-[16px] w-[16px]" />
              </button>
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

function EventSignupModal({ banner, onClose }: { banner: Banner | null; onClose: () => void }) {
  useEffect(() => {
    if (!banner) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [banner, onClose]);

  return (
    <AnimatePresence>
      {banner && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[var(--z-popover)] flex items-end justify-center p-0 sm:items-center sm:p-4"
          style={{ background: "rgba(0,0,0,0.55)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 30, opacity: 0, scale: 0.98 }}
            animate={{ y: 0, opacity: 1, scale: 1 }}
            exit={{ y: 30, opacity: 0, scale: 0.98 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="w-full rounded-t-[20px] p-[22px] sm:max-w-[420px] sm:rounded-[18px]"
            style={{ background: "var(--background-elevated)", border: "1px solid var(--border)" }}
          >
            <div
              className="grid h-[44px] w-[44px] place-items-center rounded-full"
              style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
            >
              <CalendarDays className="h-[22px] w-[22px]" />
            </div>
            <h3
              className="mt-[14px] text-[18px] font-bold"
              style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
            >
              Регистрация на мероприятие
            </h3>
            <p
              className="mt-[6px] text-[14px] leading-relaxed"
              style={{ color: "var(--foreground-70)" }}
            >
              {banner.title}
            </p>
            <p className="mt-[10px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
              Заявка будет доступна после подключения модуля мероприятий.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="mt-[18px] h-[44px] w-full rounded-[12px] text-[14px] font-semibold text-[var(--accent-foreground)] transition-transform active:scale-[0.99]"
              style={{ background: "var(--accent)" }}
            >
              Понятно
            </button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
