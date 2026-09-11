import {
  useDeferredValue,
  useEffect,
  useId,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { createPortal } from "react-dom";
import { Clock, Search, Smile } from "lucide-react";
import { TAP_TARGET_44 } from "@/lib/tap-target";
import { searchEmojis, type EmojiCatalog, type EmojiEntry } from "@/lib/emoji/catalog";
import { loadEmojiCatalog, peekEmojiCatalog } from "@/lib/emoji/load";
import { pushRecentEmoji, readRecentEmojis, saveRecentEmojis } from "@/lib/emoji/recent";
import { reportReadFailure } from "@/lib/errors/handle";

interface Props {
  onPick: (emoji: string) => void;
  /** Align panel to the trigger button edge — use "end" when the button sits on the right. */
  align?: "start" | "end";
  /** Smaller trigger for compact composers (e.g. category room chat). */
  compact?: boolean;
  /** Return false to keep the panel closed (e.g. guest auth gate). */
  onBeforeOpen?: () => boolean;
}

const PANEL_WIDTH = 320;
const PANEL_HEIGHT = 360;
const PANEL_MIN_HEIGHT = 200;
const PANEL_GAP = 8;
const VIEWPORT_PAD = 12;
const COLUMNS = 8;
const RECENT_TAB = "recent";

const GRID_STEPS: Record<string, number> = {
  ArrowRight: 1,
  ArrowLeft: -1,
  ArrowDown: COLUMNS,
  ArrowUp: -COLUMNS,
};

export function EmojiPicker({ onPick, align = "start", compact = false, onBeforeOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  /*
    Куда рисовать панель: в ближайшее окно (role="dialog") кнопки, иначе в body.

    Композер записи, репост и правка записи живут в модальном окне Radix.
    Панель в body оказывалась «снаружи» окна: нажатие на смайл Radix считал
    кликом мимо и закрывал окно, а ловушка фокуса не пускала в поиск.
    Внутри окна и то и другое — «внутри».
  */
  const hostRef = useRef<HTMLElement | null>(null);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gridRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const frameRef = useRef(0);
  /** Фокус в поиск при открытии — с клавиатуры и мышью, но не пальцем:
   *  на телефоне это подняло бы клавиатуру поверх панели. */
  const focusSearchRef = useRef(false);
  /** Height is measured once per opening: resizing it mid-scroll made the
   *  whole grid reflow and the emoji rows jump under the cursor. */
  const heightRef = useRef(0);
  const [panelStyle, setPanelStyle] = useState<{
    top: number;
    left: number;
    width: number;
    height: number;
  } | null>(null);

  // Каталог общий для всех панелей страницы и держится в памяти модуля.
  const [catalog, setCatalog] = useState<EmojiCatalog | null>(() => peekEmojiCatalog());
  const [loadFailed, setLoadFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [recent, setRecent] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const deferredQuery = useDeferredValue(query);
  const [tab, setTab] = useState<string | null>(null);

  useEffect(() => setMounted(true), []);

  const updatePosition = (remeasureHeight = false) => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const width = Math.min(PANEL_WIDTH, vw - VIEWPORT_PAD * 2);

    let left = align === "end" ? rect.right - width : rect.left;
    left = Math.max(VIEWPORT_PAD, Math.min(left, vw - width - VIEWPORT_PAD));

    const spaceAbove = rect.top - VIEWPORT_PAD - PANEL_GAP;
    const spaceBelow = vh - rect.bottom - VIEWPORT_PAD - PANEL_GAP;
    const preferAbove = spaceAbove >= PANEL_HEIGHT || spaceAbove >= spaceBelow;
    if (remeasureHeight || heightRef.current === 0) {
      heightRef.current = Math.min(
        PANEL_HEIGHT,
        vh - VIEWPORT_PAD * 2,
        Math.max(PANEL_MIN_HEIGHT, preferAbove ? spaceAbove : spaceBelow),
      );
    }
    const height = heightRef.current;
    const top = preferAbove
      ? Math.max(VIEWPORT_PAD, rect.top - PANEL_GAP - height)
      : Math.max(VIEWPORT_PAD, Math.min(rect.bottom + PANEL_GAP, vh - VIEWPORT_PAD - height));

    /*
      Окно Radix и шторка vaul сдвинуты transform-ом, а у потомков такого
      узла position: fixed считается от него, не от экрана. Тогда вычитаем
      его угол — панель встаёт туда же, где встала бы в body.
    */
    const h = hostRef.current;
    if (h && h !== document.body && getComputedStyle(h).transform !== "none") {
      const hr = h.getBoundingClientRect();
      setPanelStyle({
        top: top - hr.top - h.clientTop,
        left: left - hr.left - h.clientLeft,
        width,
        height,
      });
      return;
    }
    setPanelStyle({ top, left, width, height });
  };

  useLayoutEffect(() => {
    if (!open) {
      heightRef.current = 0;
      setPanelStyle(null);
      return;
    }
    hostRef.current = triggerRef.current?.closest<HTMLElement>('[role="dialog"]') ?? document.body;
    setHost(hostRef.current);
    updatePosition(true);

    const schedule = (event: Event) => {
      // Scrolling the emoji grid itself must not move the panel.
      if (event.target instanceof Node && panelRef.current?.contains(event.target)) return;
      if (frameRef.current) return;
      frameRef.current = window.requestAnimationFrame(() => {
        frameRef.current = 0;
        updatePosition();
      });
    };
    const onResize = () => updatePosition(true);

    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", schedule, true);
    return () => {
      if (frameRef.current) window.cancelAnimationFrame(frameRef.current);
      frameRef.current = 0;
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", schedule, true);
    };
  }, [open, align]);

  /** Закрыть; если фокус был внутри панели — вернуть его на кнопку. */
  const close = (restoreFocus: boolean) => {
    if (restoreFocus && panelRef.current?.contains(document.activeElement)) {
      triggerRef.current?.focus({ preventScroll: true });
    }
    setOpen(false);
  };
  const closeRef = useRef(close);
  closeRef.current = close;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      closeRef.current(false);
    };
    /*
     * Escape закрывает панель — и только её.
     *
     * Просмотрщик записи слушает Escape на том же `document` и закрывается
     * вместе с ней: человек, открывший смайлы поверх записи, одним нажатием
     * терял и панель, и запись, — а потом не мог открыть панель снова,
     * потому что нажимать было уже не на что. Найдено 09.09 на проде.
     *
     * Перехват (`capture`) идёт до обработчиков, повешенных на всплытии, —
     * поэтому здесь и останавливается: верхний слой закрывается первым и
     * событие дальше не пускает.
     */
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      closeRef.current(true);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [open]);

  // Данные — при первом открытии, отдельным чанком; дальше из памяти модуля.
  useEffect(() => {
    if (!open || catalog) return;
    let cancelled = false;
    setLoadFailed(false);
    loadEmojiCatalog().then(
      (data) => {
        if (!cancelled) setCatalog(data);
      },
      (error: unknown) => {
        reportReadFailure(error, "emoji catalog");
        if (!cancelled) setLoadFailed(true);
      },
    );
    return () => {
      cancelled = true;
    };
  }, [open, catalog, attempt]);

  const panelShown = open && panelStyle !== null;
  useEffect(() => {
    if (!panelShown || !focusSearchRef.current) return;
    focusSearchRef.current = false;
    searchRef.current?.focus({ preventScroll: true });
  }, [panelShown]);

  const recentEntries = useMemo(
    () =>
      catalog
        ? recent
            .map((u) => catalog.byUnicode.get(u))
            .filter((e): e is EmojiEntry => e !== undefined)
        : [],
    [catalog, recent],
  );

  const searching = deferredQuery.trim().length > 0;
  const results = useMemo(
    () => (catalog && searching ? searchEmojis(catalog.all, deferredQuery) : []),
    [catalog, searching, deferredQuery],
  );

  const activeTab = tab ?? (recentEntries.length > 0 ? RECENT_TAB : catalog?.categories[0]?.key);
  const activeCategory = catalog?.categories.find((c) => c.key === activeTab);

  const section = searching
    ? { title: "Результаты поиска", items: results, empty: "Ничего не нашлось" }
    : activeTab === RECENT_TAB
      ? {
          title: "Недавние",
          items: recentEntries,
          empty: "Здесь появятся смайлы, которые вы выбирали",
        }
      : { title: activeCategory?.name ?? "", items: activeCategory?.items ?? [], empty: "" };

  // Новая вкладка или выдача — с начала списка.
  useLayoutEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 0;
  }, [activeTab, searching]);

  const openPanel = (e: ReactMouseEvent<HTMLButtonElement>) => {
    if (open) {
      close(false);
      return;
    }
    if (onBeforeOpen && !onBeforeOpen()) return;
    setRecent(readRecentEmojis());
    setQuery("");
    setTab(null);
    // detail 0 — нажатие с клавиатуры (Enter/Space на кнопке).
    focusSearchRef.current =
      e.detail === 0 || window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    setOpen(true);
  };

  const pick = (emoji: string) => {
    const next = pushRecentEmoji(recent, emoji);
    saveRecentEmojis(next);
    setRecent(next);
    onPick(emoji);
    setOpen(false);
  };

  const emojiButtons = () =>
    gridRef.current
      ? [...gridRef.current.querySelectorAll<HTMLButtonElement>("button[data-emoji]")]
      : [];

  const onGridKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    const step = GRID_STEPS[e.key];
    if (!step) return;
    const buttons = emojiButtons();
    const index = buttons.indexOf(document.activeElement as HTMLButtonElement);
    if (index < 0) return;
    const next = buttons[index + step];
    if (!next) return;
    e.preventDefault();
    next.focus();
  };

  const onSearchKeyDown = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      const first = emojiButtons()[0];
      if (first) {
        e.preventDefault();
        first.focus();
      }
    } else if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      // По текущему вводу, а не по отложенной выдаче: при быстром наборе
      // она отстаёт на нажатие и выбрала бы смайл для прежнего запроса.
      const first = catalog ? searchEmojis(catalog.all, query)[0] : undefined;
      if (first) pick(first.unicode);
    }
  };

  // Визуал у компактного варианта 36px, у обычного — 40px на десктопе;
  // палец в обоих случаях попадает в 44.
  const triggerClass = compact
    ? `grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px] transition-colors hover:bg-[var(--background-surface)] ${TAP_TARGET_44}`
    : `grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full sm:h-[40px] sm:w-[40px] ${TAP_TARGET_44}`;

  const tabs = catalog
    ? [
        { key: RECENT_TAB, name: "Недавние", icon: null },
        ...catalog.categories.map((c) => ({ key: c.key, name: c.name, icon: c.icon })),
      ]
    : null;

  const skeletonCells = Array.from({ length: COLUMNS * 6 }, (_, i) => i);

  /*
   * Без анимации появления и ухода.
   *
   * Панель жила внутри `AnimatePresence` и уходила затуханием. Прерванный
   * уход оставлял её узел в `body` навсегда — `opacity: 0`, `pointer-events:
   * auto`, слой popover, — и следующее открытие рисовало в тот же
   * застрявший узел: панель больше никогда не становилась видимой. Ровно
   * это и выглядело как «кнопка эмодзи не работает, повторное нажатие тоже».
   * Заодно призрак 280×240 молча перехватывал нажатия по комментариям под
   * собой.
   *
   * Всплывающему списку анимация ухода не нужна: он либо есть, либо его нет.
   * А узел, которого нет, не может застрять.
   *
   * Размер панели задаётся только положением кнопки и экраном — не
   * содержимым: заглушка загрузки, пустые «Недавние», выдача поиска и любая
   * категория занимают одну и ту же область прокрутки.
   */
  const panel =
    mounted && open && panelStyle ? (
      <div
        ref={panelRef}
        role="dialog"
        aria-label="Выбор смайла"
        className="fixed z-[var(--z-popover)] flex flex-col overflow-hidden rounded-[12px] border"
        style={{
          top: panelStyle.top,
          left: panelStyle.left,
          width: panelStyle.width,
          height: panelStyle.height,
          background: "var(--background-elevated)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-float)",
          pointerEvents: "auto",
        }}
      >
        <div className="shrink-0 px-2 pt-2 pb-1">
          <label
            className="flex h-9 items-center gap-2 rounded-[var(--r-input)] px-2"
            style={{ background: "var(--background-surface)", color: "var(--foreground-50)" }}
          >
            <Search size={16} aria-hidden="true" className="shrink-0" />
            <input
              ref={searchRef}
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={onSearchKeyDown}
              placeholder="Поиск смайла"
              aria-label="Поиск смайла"
              enterKeyHint="search"
              autoComplete="off"
              spellCheck={false}
              className="h-full min-w-0 flex-1 bg-transparent text-[16px] sm:text-[14px]"
              style={{ color: "var(--foreground)" }}
            />
          </label>
        </div>

        <div
          role="tablist"
          aria-label="Категории смайлов"
          className="flex shrink-0 gap-1 border-b px-2 pb-1"
          style={{ borderColor: "var(--border)" }}
        >
          {tabs
            ? tabs.map((t) => {
                const selected = !searching && t.key === activeTab;
                return (
                  <button
                    key={t.key}
                    type="button"
                    role="tab"
                    aria-selected={selected}
                    aria-controls={panelId}
                    aria-label={t.name}
                    title={t.name}
                    onClick={() => {
                      setQuery("");
                      setTab(t.key);
                    }}
                    className="grid h-8 min-w-0 flex-1 place-items-center rounded-[var(--r-tag)] text-[18px] leading-none transition-colors hover:bg-[var(--background-surface)]"
                    style={{
                      background: selected ? "var(--accent-soft)" : undefined,
                      color: selected ? "var(--accent)" : "var(--foreground-50)",
                      filter: selected || !t.icon ? undefined : "grayscale(0.6)",
                    }}
                  >
                    {t.icon ?? <Clock size={16} aria-hidden="true" />}
                  </button>
                );
              })
            : Array.from({ length: 10 }, (_, i) => (
                <span
                  key={i}
                  className="h-8 min-w-0 flex-1 animate-pulse rounded-[var(--r-tag)]"
                  style={{ background: "var(--background-surface)" }}
                />
              ))}
        </div>

        <div
          ref={scrollRef}
          className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2"
          style={{ scrollbarWidth: "thin" }}
        >
          {loadFailed && !catalog ? (
            <div
              className="flex h-full flex-col items-center justify-center gap-3 px-4 text-center text-[13px]"
              style={{ color: "var(--foreground-50)" }}
            >
              <p>Не удалось загрузить смайлы</p>
              <button
                type="button"
                onClick={() => setAttempt((n) => n + 1)}
                className="h-8 rounded-[var(--r-button)] px-3 text-[13px] font-semibold"
                style={{ background: "var(--accent)", color: "var(--accent-foreground)" }}
              >
                Повторить
              </button>
            </div>
          ) : !catalog ? (
            <div aria-busy="true" aria-label="Загрузка смайлов">
              <div
                className="mb-2 h-3 w-24 animate-pulse rounded-[var(--r-tag)]"
                style={{ background: "var(--background-surface)" }}
              />
              <div className="grid grid-cols-8 gap-1">
                {skeletonCells.map((i) => (
                  <span
                    key={i}
                    className="h-9 animate-pulse rounded-[var(--r-tag)]"
                    style={{ background: "var(--background-surface)" }}
                  />
                ))}
              </div>
            </div>
          ) : (
            <div id={panelId} role="tabpanel">
              <div
                className="mb-2 px-1 text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--foreground-50)" }}
              >
                {section.title}
              </div>
              {section.items.length === 0 ? (
                <p
                  className="px-1 py-6 text-center text-[13px]"
                  style={{ color: "var(--foreground-50)" }}
                >
                  {section.empty}
                </p>
              ) : (
                <div ref={gridRef} className="grid grid-cols-8 gap-1" onKeyDown={onGridKeyDown}>
                  {section.items.map((e) => (
                    <button
                      key={e.unicode}
                      type="button"
                      data-emoji
                      onClick={() => pick(e.unicode)}
                      className="grid h-9 w-full place-items-center rounded-[var(--r-tag)] text-[22px] leading-none transition-colors hover:bg-[var(--background-surface)] active:scale-95"
                      aria-label={e.label}
                      title={e.label}
                    >
                      {e.unicode}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={openPanel}
        className={triggerClass}
        style={{ color: open ? "var(--accent)" : "var(--foreground-50)" }}
        aria-label="Смайлы"
        aria-expanded={open}
        aria-haspopup="dialog"
        title="Смайлы"
      >
        <Smile size={compact ? 16 : 18} />
      </button>
      {mounted ? createPortal(panel, host ?? document.body) : null}
    </>
  );
}
