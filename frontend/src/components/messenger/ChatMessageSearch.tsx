import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Search, X, ChevronUp, ChevronDown, CalendarDays } from "lucide-react";
import type { Message } from "@/lib/mock";
import { formatRelativeTime, userById } from "@/lib/mock";
import { fetchMessagesForSearch } from "@/lib/api/chat";
import { messagePreview, searchMessages } from "@/lib/message-search";
import { HighlightedText } from "@/components/messenger/HighlightedText";
import { isDemoMode } from "@/lib/demo-mode";

interface Props {
  open: boolean;
  dialogId: string;
  messages: Message[];
  meId: string;
  onClose: () => void;
  onJumpTo: (messageId: string, query: string) => void;
  onMessagesLoaded?: (messages: Message[]) => void;
}

export function ChatMessageSearch({
  open,
  dialogId,
  messages,
  meId,
  onClose,
  onJumpTo,
  onMessagesLoaded,
}: Props) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [showDates, setShowDates] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [pool, setPool] = useState<Message[]>(messages);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setDateFrom("");
    setDateTo("");
    setShowDates(false);
    setActiveIndex(0);
    setPool(messages);
    setLoadingHistory(true);
    let alive = true;

    if (isDemoMode()) {
      setLoadingHistory(false);
      return;
    }

    fetchMessagesForSearch(dialogId)
      .then((all) => {
        if (!alive) return;
        setPool(all);
        onMessagesLoaded?.(all);
      })
      .catch(() => {
        if (!alive) return;
        setPool(messages);
      })
      .finally(() => {
        if (alive) setLoadingHistory(false);
      });

    return () => {
      alive = false;
    };
  }, [open, dialogId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!open) return;
    const t = window.setTimeout(() => inputRef.current?.focus(), 120);
    return () => window.clearTimeout(t);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [open]);

  const results = useMemo(
    () => searchMessages(pool, query, { dateFrom: dateFrom || undefined, dateTo: dateTo || undefined }),
    [pool, query, dateFrom, dateTo],
  );

  useEffect(() => {
    setActiveIndex(0);
  }, [query, dateFrom, dateTo, pool.length]);

  useEffect(() => {
    if (activeIndex >= results.length && results.length > 0) {
      setActiveIndex(results.length - 1);
    }
  }, [activeIndex, results.length]);

  const goTo = (index: number) => {
    const msg = results[index];
    if (!msg) return;
    setActiveIndex(index);
    onJumpTo(msg.id, query.trim());
  };

  const goNext = () => {
    if (results.length === 0) return;
    goTo((activeIndex + 1) % results.length);
  };

  const goPrev = () => {
    if (results.length === 0) return;
    goTo((activeIndex - 1 + results.length) % results.length);
  };

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      } else if (e.key === "Enter" && e.shiftKey) {
        e.preventDefault();
        goPrev();
      } else if (e.key === "Enter" && results.length > 0) {
        e.preventDefault();
        goNext();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, results, activeIndex, query, onClose]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!mounted) return null;

  const hasFilter = query.trim() || dateFrom || dateTo;
  const countLabel = results.length
    ? `${activeIndex + 1} из ${results.length}`
    : hasFilter
      ? "0 результатов"
      : "";

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          key="chat-search"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.18 }}
          className="fixed inset-0 z-[10000] flex items-center justify-center p-[16px]"
          style={{ background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)" }}
          onClick={onClose}
        >
          <motion.div
            initial={{ y: 16, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 12, opacity: 0 }}
            transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-[min(85dvh,640px)] w-full max-w-[520px] flex-col overflow-hidden rounded-[16px] border"
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            <div className="flex items-center justify-between px-[18px] pt-[16px] pb-[10px]">
              <div className="font-display text-[16px] font-bold" style={{ color: "var(--foreground)" }}>
                Поиск по сообщениям
              </div>
              <button
                type="button"
                onClick={onClose}
                className="grid h-[32px] w-[32px] place-items-center rounded-full hover:bg-[var(--background-surface)]"
                style={{ color: "var(--foreground-50)" }}
                aria-label="Закрыть поиск"
              >
                <X size={18} />
              </button>
            </div>

            <div className="px-[18px] pb-[12px]">
              <div className="relative flex items-center gap-[8px]">
                <div className="relative min-w-0 flex-1">
                  <Search
                    size={16}
                    className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2"
                    style={{ color: "var(--foreground-50)" }}
                  />
                  <input
                    ref={inputRef}
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Поиск по истории сообщений"
                    className="w-full text-[14px] outline-none"
                    style={{
                      height: 42,
                      paddingLeft: 36,
                      paddingRight: 12,
                      background: "var(--background-surface)",
                      borderRadius: 12,
                      border: "1.5px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowDates((v) => !v)}
                  className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[12px] transition-colors"
                  style={{
                    background: showDates || dateFrom || dateTo ? "var(--accent-soft)" : "var(--background-surface)",
                    color: showDates || dateFrom || dateTo ? "var(--accent)" : "var(--foreground-50)",
                    border: "1.5px solid var(--border)",
                  }}
                  aria-label="Фильтр по дате"
                  aria-pressed={showDates || Boolean(dateFrom || dateTo)}
                >
                  <CalendarDays size={18} />
                </button>
              </div>

              {showDates && (
                <div className="mt-[10px] grid grid-cols-2 gap-[8px]">
                  <label className="grid gap-[4px]">
                    <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--foreground-50)" }}>С</span>
                    <input
                      type="date"
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="w-full text-[13px] outline-none"
                      style={{
                        height: 36,
                        padding: "0 10px",
                        background: "var(--background-surface)",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                    />
                  </label>
                  <label className="grid gap-[4px]">
                    <span className="text-[11px] uppercase tracking-wide" style={{ color: "var(--foreground-50)" }}>По</span>
                    <input
                      type="date"
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="w-full text-[13px] outline-none"
                      style={{
                        height: 36,
                        padding: "0 10px",
                        background: "var(--background-surface)",
                        borderRadius: 10,
                        border: "1px solid var(--border)",
                        color: "var(--foreground)",
                      }}
                    />
                  </label>
                </div>
              )}

              {hasFilter && (
                <div className="mt-[10px] flex items-center justify-between gap-[8px]">
                  <span className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                    {loadingHistory ? "Загружаем историю…" : countLabel}
                  </span>
                  {results.length > 0 && (
                    <div className="flex items-center gap-[4px]">
                      <button
                        type="button"
                        onClick={goPrev}
                        className="grid h-[32px] w-[32px] place-items-center rounded-full hover:bg-[var(--background-surface)]"
                        style={{ color: "var(--foreground-70)" }}
                        aria-label="Предыдущее совпадение"
                      >
                        <ChevronUp size={18} />
                      </button>
                      <button
                        type="button"
                        onClick={goNext}
                        className="grid h-[32px] w-[32px] place-items-center rounded-full hover:bg-[var(--background-surface)]"
                        style={{ color: "var(--foreground-70)" }}
                        aria-label="Следующее совпадение"
                      >
                        <ChevronDown size={18} />
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-[8px] pb-[12px]">
              {!hasFilter ? (
                <div className="flex flex-col items-center justify-center px-[24px] py-[48px] text-center">
                  <Search size={40} style={{ color: "var(--foreground-15)" }} />
                  <p className="mt-[12px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
                    Начните вводить текст сообщения в поле поиска
                  </p>
                </div>
              ) : loadingHistory && results.length === 0 ? (
                <div className="py-[40px] text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>
                  Загрузка…
                </div>
              ) : results.length === 0 ? (
                <div className="py-[40px] text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>
                  Ничего не найдено
                </div>
              ) : (
                <ul className="space-y-[2px]">
                  {results.map((m, i) => {
                    const author = userById(m.authorId);
                    const preview = messagePreview(m);
                    const selected = i === activeIndex;
                    return (
                      <li key={m.id}>
                        <button
                          type="button"
                          onClick={() => goTo(i)}
                          className="flex w-full flex-col gap-[4px] rounded-[12px] px-[12px] py-[10px] text-left transition-colors"
                          style={{
                            background: selected ? "var(--accent-soft)" : "transparent",
                          }}
                        >
                          <div className="flex items-center justify-between gap-[8px]">
                            <span className="truncate text-[12px] font-semibold" style={{ color: "var(--foreground)" }}>
                              {m.authorId === meId ? "Вы" : author.name}
                            </span>
                            <span className="shrink-0 font-mono text-[11px]" style={{ color: "var(--foreground-50)" }}>
                              {formatRelativeTime(m.time)}
                            </span>
                          </div>
                          <div className="line-clamp-2 text-[13px]" style={{ color: "var(--foreground-70)" }}>
                            {query.trim() ? (
                              <HighlightedText text={preview} query={query} />
                            ) : (
                              preview
                            )}
                          </div>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
