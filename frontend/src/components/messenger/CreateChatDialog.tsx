import { useTranslation } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Search } from "lucide-react";
import { users as allUsers, me } from "@/lib/mock";
import { useDebounce } from "@/hooks/useDebounce";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (userId: string) => void;
}

export function CreateChatDialog({ open, onClose, onPick }: Props) {
  const { t } = useTranslation();
  const [query, setQuery] = useState("");
  const debounced = useDebounce(query, 250);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const candidates = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return allUsers
      .filter((u) => u.id !== me.id)
      .filter((u) => !q || u.name.toLowerCase().includes(q));
  }, [debounced]);

  useEffect(() => {
    setHighlight(0);
  }, [debounced]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const t = setTimeout(() => inputRef.current?.focus(), 50);
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => {
      clearTimeout(t);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  const pickAt = (i: number) => {
    const u = candidates[i];
    if (u) onPick(u.id);
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            key="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            className="fixed inset-0 z-[80]"
            style={{ background: "rgba(0,0,0,0.4)" }}
            onClick={onClose}
          />
          <motion.div
            key="dialog"
            initial={{ opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 12, scale: 0.97 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-[81] w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[16px] border"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            <div className="flex items-center gap-[8px] border-b px-[16px] py-[12px]" style={{ borderColor: "var(--border)" }}>
              <h3 className="flex-1 font-display text-[16px] font-bold" style={{ color: "var(--foreground)" }}>{t("messenger.newChat")}</h3>
              <button
                onClick={onClose}
                className="grid h-[32px] w-[32px] place-items-center rounded-full"
                style={{ color: "var(--foreground-50)" }}
                aria-label={t("common.close")}
              >
                <X size={16} />
              </button>
            </div>

            <div className="relative p-[12px]">
              <Search className="pointer-events-none absolute left-[24px] top-1/2 -translate-y-1/2" size={16} style={{ color: "var(--foreground-50)" }} />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlight((h) => Math.min(h + 1, candidates.length - 1));
                  } else if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlight((h) => Math.max(h - 1, 0));
                  } else if (e.key === "Enter") {
                    e.preventDefault();
                    pickAt(highlight);
                  }
                }}
                placeholder={t("messenger.searchByName")}
                className="w-full text-[14px] outline-none"
                style={{
                  height: 40, paddingLeft: 36, paddingRight: 12,
                  background: "var(--background-surface)", borderRadius: 10,
                  border: "1.5px solid transparent", color: "var(--foreground)",
                }}
                onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
                onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
              />
            </div>

            <ul className="max-h-[320px] overflow-y-auto pb-[8px]" role="listbox">
              {candidates.length === 0 ? (
                <li className="px-[20px] py-[24px] text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("friends.empty")}</li>
              ) : (
                candidates.map((u, i) => {
                  const active = i === highlight;
                  return (
                    <li key={u.id} role="option" aria-selected={active}>
                      <button
                        onMouseEnter={() => setHighlight(i)}
                        onClick={() => pickAt(i)}
                        className="flex w-full items-center gap-[12px] px-[16px] py-[10px] text-left"
                        style={{ background: active ? "var(--background-surface)" : "transparent" }}
                      >
                        <img src={u.avatar} alt="" className="h-[36px] w-[36px] rounded-full object-cover" />
                        <div className="min-w-0 flex-1">
                          <div className="truncate text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>{u.name}</div>
                          <div className="truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>
                            {u.online ? t("messenger.online") : t("messenger.recently")}
                          </div>
                        </div>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
