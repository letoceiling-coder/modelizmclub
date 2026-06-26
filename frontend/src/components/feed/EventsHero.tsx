import { useTranslation } from "@/lib/i18n";
import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, X, CalendarDays, Newspaper, Sparkles } from "lucide-react";
import type { Banner } from "@/lib/mock";
import { banners as allBanners } from "@/lib/mock";

const AUTOPLAY_MS = 10_000;

function sortBanners(list: Banner[]): Banner[] {
  return [...list].sort((a, b) => {
    if ((b.pinned ? 1 : 0) !== (a.pinned ? 1 : 0)) return (b.pinned ? 1 : 0) - (a.pinned ? 1 : 0);
    return (b.priority ?? 0) - (a.priority ?? 0);
  });
}

const KIND_KEYS: Record<NonNullable<Banner["kind"]>, { key: string; Icon: typeof CalendarDays }> = {
  event: { key: "components.eventKind", Icon: CalendarDays },
  news: { key: "components.newsKind", Icon: Newspaper },
  promo: { key: "components.promoKind", Icon: Sparkles },
};

export function EventsHero() {
  const { t } = useTranslation();
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const list = useMemo(
    () => sortBanners(allBanners.filter((b) => !dismissed.has(b.id))).slice(0, 3),
    [dismissed],
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
  const kind = KIND_KEYS[current.kind ?? "news"];

  const prev = () => setIndex((i) => (i - 1 + list.length) % list.length);
  const next = () => setIndex((i) => (i + 1) % list.length);
  const dismiss = (id: string) =>
    setDismissed((p) => {
      const n = new Set(p);
      n.add(id);
      return n;
    });

  return (
    <section
      aria-label={t("components.eventsHeroAria")}
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
            <div className={`absolute inset-0 bg-gradient-to-br ${current.color}`} />
            {current.image ? (
              <img src={current.image} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : null}
            <div
              className="absolute inset-0"
              style={{
                background:
                  "linear-gradient(180deg, color-mix(in oklab, #000 10%, transparent) 0%, color-mix(in oklab, #000 70%, transparent) 100%)",
              }}
            />

            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-[10px] p-[18px] sm:p-[22px]">
              <span
                className="inline-flex w-fit items-center gap-[6px] rounded-full px-[10px] py-[4px] text-[11px] font-medium uppercase tracking-wide text-white"
                style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(6px)" }}
              >
                <kind.Icon className="h-[12px] w-[12px]" />
                {t(kind.key)}
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
                  className="inline-flex items-center rounded-[10px] bg-white px-[14px] py-[8px] text-[13px] font-semibold text-slate-900 transition-transform hover:scale-[1.02] active:scale-[0.99]"
                >
                  {current.cta}
                </button>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>

        <button
          onClick={() => dismiss(current.id)}
          aria-label={t("components.hideBanner")}
          className="absolute right-[10px] top-[10px] grid h-[28px] w-[28px] place-items-center rounded-full text-white"
          style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)" }}
        >
          <X className="h-[14px] w-[14px]" />
        </button>

        {list.length > 1 && (
          <>
            <button
              onClick={prev}
              aria-label={t("components.carouselPrevious")}
              className="absolute left-[10px] top-1/2 hidden -translate-y-1/2 place-items-center rounded-full text-white sm:grid h-[32px] w-[32px]"
              style={{ background: "rgba(0,0,0,0.4)", backdropFilter: "blur(6px)" }}
            >
              <ChevronLeft className="h-[16px] w-[16px]" />
            </button>
            <button
              onClick={next}
              aria-label={t("components.carouselNext")}
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
                aria-label={t("components.goToBanner", { n: i + 1 })}
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
  );
}
