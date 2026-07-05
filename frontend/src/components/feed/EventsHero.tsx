import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { useNavigate } from "@tanstack/react-router";
import { ChevronLeft, ChevronRight, CalendarDays, Newspaper, Sparkles } from "lucide-react";
import type { Banner } from "@/lib/mock";
import { fetchBanners } from "@/lib/api/banners";

const AUTOPLAY_MS = 10_000;

function sortBanners(list: Banner[]): Banner[] {
  return [...list].sort((a, b) => {
    if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    return (b.priority ?? 0) - (a.priority ?? 0);
  });
}

const KIND_LABEL: Record<NonNullable<Banner["kind"]>, { label: string; Icon: typeof CalendarDays }> = {
  event: { label: "Событие", Icon: CalendarDays },
  news: { label: "Новость", Icon: Newspaper },
  promo: { label: "Акция", Icon: Sparkles },
};

export function EventsHero() {
  const navigate = useNavigate();
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [allBanners, setAllBanners] = useState<Banner[]>([]);
  const [signup, setSignup] = useState<Banner | null>(null);

  useEffect(() => {
    let active = true;
    fetchBanners("events")
      .then((b) => active && setAllBanners(b))
      .catch(() => {});
    return () => { active = false; };
  }, []);

  // Видимость баннера управляется только из /admin (переключатель «Показывать»),
  // обычный пользователь не может закрыть баннер вручную.
  const list = useMemo(
    () => sortBanners(allBanners.filter((b) => b.active !== false)).slice(0, 3),
    [allBanners],
  );

  useEffect(() => {
    if (list.length <= 1 || paused) return;
    const id = setInterval(() => setIndex((i) => (i + 1) % list.length), AUTOPLAY_MS);
    return () => clearInterval(id);
  }, [list.length, paused]);

  useEffect(() => {
    if (index >= list.length) setIndex(0);
  }, [index, list.length]);

  if (list.length === 0) return null;

  const current = list[index];
  const kind = KIND_LABEL[current.kind ?? "news"];

  const prev = () => setIndex((i) => (i - 1 + list.length) % list.length);
  const next = () => setIndex((i) => (i + 1) % list.length);
  const openCta = (b: Banner) => {
    const link = b.link?.trim();
    // Real external link → open it. Otherwise show the event signup dialog
    // (the demo stand has no events backend to route to).
    if (link && /^https?:\/\//i.test(link)) {
      window.open(link, "_blank", "noopener,noreferrer");
      return;
    }
    if (link) {
      void navigate({ to: link });
      return;
    }
    setSignup(b);
  };
  return (
    <>
    <section
      aria-label="События и новости форума"
      className="relative overflow-hidden rounded-[16px] border"
      style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative h-[200px] sm:h-[220px] md:h-[240px]">
        <AnimatePresence mode="wait">
          <motion.div
            key={current.id}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.45, ease: [0.22, 1, 0.36, 1] }}
            className="absolute inset-0"
          >
            {current.image ? (
              <img src={current.image} alt="" className="h-full w-full object-cover" />
            ) : (
              <div className={`h-full w-full bg-gradient-to-br ${current.color}`} />
            )}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in oklab, #000 10%, transparent) 0%, color-mix(in oklab, #000 70%, transparent) 100%)",
              }}
            />

            {/* sm+ side padding keeps text/CTA clear of the prev/next arrows */}
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[10px] p-[18px] sm:p-[22px] sm:px-[56px]">
              <span
                className="inline-flex w-fit items-center gap-[6px] rounded-full px-[10px] py-[4px] text-[11px] font-medium uppercase tracking-wide text-white"
                style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
              >
                <kind.Icon className="h-[12px] w-[12px]" />
                {kind.label}
                <span className="opacity-70">· {current.until}</span>
              </span>
              <h2
                className="max-w-[90%] text-[20px] font-semibold leading-tight text-white sm:text-[22px]"
                style={{ fontFamily: "var(--font-display)" }}
              >
                {current.title}
              </h2>
              <p className="max-w-[640px] text-[13px] text-white/85 sm:text-[14px]">{current.text}</p>
              <div className="mt-[4px]">
                <button
                  type="button"
                  onClick={() => openCta(current)}
                  className="inline-flex items-center rounded-[10px] bg-white px-[14px] py-[8px] text-[13px] font-semibold text-slate-900 transition-transform hover:scale-[1.02] active:scale-[0.99]"
                >
                  {current.cta}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        {list.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label="Предыдущий"
              className="absolute left-[10px] top-1/2 hidden -translate-y-1/2 place-items-center rounded-full text-white sm:grid h-[32px] w-[32px]"
              style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)" }}
            >
              <ChevronLeft className="h-[16px] w-[16px]" />
            </button>
            <button
              onClick={next}
              aria-label="Следующий"
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
                className="rounded-full transition-all"
                style={{
                  width: active ? 20 : 6,
                  height: 6,
                  background: active ? "var(--accent)" : "var(--foreground-30, color-mix(in oklab, var(--foreground) 25%, transparent))",
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

/** Lightweight event-signup confirmation. Demo stand has no events backend,
 *  so this records the intent in-session and confirms to the user. */
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
          className="fixed inset-0 z-[60] flex items-end justify-center p-0 sm:items-center sm:p-4"
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
            <p className="mt-[6px] text-[14px] leading-relaxed" style={{ color: "var(--foreground-70)" }}>
              {banner.title}
            </p>
            <p className="mt-[10px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
              Demo mode: заявка на событие сохранена. На боевой версии здесь будет форма записи и подтверждение по email.
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
