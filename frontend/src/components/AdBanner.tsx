import { useTranslation } from "@/lib/i18n";
import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { toast } from "sonner";
import type { Banner } from "@/lib/types";
import { fetchBanners } from "@/lib/api/public";

export function AdBanner() {
  const { t } = useTranslation();
  const [banners, setBanners] = useState<Banner[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    void fetchBanners("sidebar").then((items) => {
      if (!cancelled) setBanners(items);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = banners.filter((b) => !dismissed.has(b.id));
  if (visible.length === 0) return null;

  const handleBannerClick = (b: Banner) => {
    if (b.linkUrl) {
      window.open(b.linkUrl, "_blank", "noopener,noreferrer");
      return;
    }
    toast(t("post.detailsSoonShort", { title: b.title }));
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
      <div className="flex snap-x snap-mandatory gap-3 overflow-x-auto px-3 pb-2 lg:px-0 [scrollbar-width:thin]">
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
                onClick={() => handleBannerClick(b)}
                aria-label={t("ads.bannerAria", { title: b.title })}
                className="relative flex w-full flex-col justify-between overflow-hidden rounded-xl bg-gradient-to-br from-[var(--accent)] to-[var(--accent-muted)] p-5 text-left text-white shadow-sm transition-transform duration-200 hover:scale-[1.01] active:scale-[0.99]"
              >
                <span className="absolute left-3 top-3 rounded-md bg-black/40 px-2 py-0.5 text-[10px] font-medium uppercase tracking-wider backdrop-blur">{t("post.sponsoredAd")}</span>
                <button
                  type="button"
                  onClick={(e) => dismiss(b.id, e)}
                  aria-label={t("components.hideBanner")}
                  className="absolute right-2 top-2 grid h-7 w-7 place-items-center rounded-full bg-black/30 text-white hover:bg-black/50"
                >
                  <X size={14} />
                </button>
                <div className="mt-6">
                  <h3 className="font-display text-lg font-bold sm:text-xl">{b.title}</h3>
                  {b.text && <p className="mt-1 text-sm text-white/85">{b.text}</p>}
                </div>
              </button>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </div>
  );
}
