import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "@/lib/toast";
import type { Banner } from "@/lib/mock";
import { fetchBanners } from "@/lib/api/banners";

export function AdBanner() {
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  const [banners, setBanners] = useState<Banner[]>([]);

  useEffect(() => {
    let active = true;
    fetchBanners("feed").then((b) => active && setBanners(b)).catch(() => {});
    return () => { active = false; };
  }, []);

  const visible = banners.filter((b) => !dismissed.has(b.id));
  if (visible.length === 0) return null;

  const handleBannerClick = (title: string) => {
    toast(`«${title}»: подробности будут доступны позже`);
  };

  const dismiss = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setDismissed((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
  };

  return (
    <div className="-mx-3 lg:mx-0">
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 lg:px-0 no-scrollbar">
        <AnimatePresence initial={false}>
          {visible.map((b) => (
            <motion.div
              key={b.id}
              layout
              initial={{ opacity: 0, scale: 0.96 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className="min-w-[85%] shrink-0 snap-start sm:min-w-[420px]"
            >
              <button
                type="button"
                onClick={() => handleBannerClick(b.title)}
                aria-label={`Баннер: ${b.title}`}
                className={`relative flex w-full flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br ${b.color} p-5 text-left text-white shadow-sm transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]`}
              >
                <span className="absolute left-3 top-3 rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider backdrop-blur">
                  Реклама
                </span>
                <button
                  type="button"
                  onClick={(e) => dismiss(b.id, e)}
                  aria-label="Скрыть баннер"
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/30 text-white hover:bg-black/50"
                >
                  <X size={14} />
                </button>
                <div className="mt-6">
                  <h3 className="font-display text-lg font-bold sm:text-xl">{b.title}</h3>
                  <p className="mt-1 text-sm text-white/85">{b.text}</p>
                  <p className="mt-1 text-[11px] text-white/60">Срок размещения {b.until}</p>
                </div>
                <span className="mt-4 self-start rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-900">
                  {b.cta}
                </span>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
