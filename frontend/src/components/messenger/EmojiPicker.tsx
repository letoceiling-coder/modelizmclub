import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { Smile } from "lucide-react";
import { MESSENGER_EMOJI_GROUPS } from "@/lib/messenger-emojis";
import { TAP_TARGET_44 } from "@/lib/messenger/tap-target";

interface Props {
  onPick: (emoji: string) => void;
  /** Align panel to the trigger button edge — use "end" when the button sits on the right. */
  align?: "start" | "end";
  /** Smaller trigger for compact composers (e.g. category room chat). */
  compact?: boolean;
  /** Return false to keep the panel closed (e.g. guest auth gate). */
  onBeforeOpen?: () => boolean;
}

const PANEL_WIDTH = 280;
const PANEL_GAP = 8;
const VIEWPORT_PAD = 12;

export function EmojiPicker({ onPick, align = "start", compact = false, onBeforeOpen }: Props) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const frameRef = useRef(0);
  /** Height is measured once per opening: resizing it mid-scroll made the
   *  whole grid reflow and the emoji rows jump under the cursor. */
  const heightRef = useRef(0);
  const [panelStyle, setPanelStyle] = useState<{
    top: number;
    left: number;
    height: number;
  } | null>(null);

  useEffect(() => setMounted(true), []);

  const updatePosition = (remeasureHeight = false) => {
    const trigger = triggerRef.current;
    if (!trigger) return;

    const rect = trigger.getBoundingClientRect();
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const panelW = Math.min(PANEL_WIDTH, vw - VIEWPORT_PAD * 2);

    let left = align === "end" ? rect.right - panelW : rect.left;
    left = Math.max(VIEWPORT_PAD, Math.min(left, vw - panelW - VIEWPORT_PAD));

    const spaceAbove = rect.top - VIEWPORT_PAD - PANEL_GAP;
    const spaceBelow = vh - rect.bottom - VIEWPORT_PAD - PANEL_GAP;
    const preferAbove = spaceAbove >= 160 || spaceAbove >= spaceBelow;
    if (remeasureHeight || heightRef.current === 0) {
      heightRef.current = Math.min(240, Math.max(120, preferAbove ? spaceAbove : spaceBelow));
    }
    const height = heightRef.current;
    const top = preferAbove
      ? Math.max(VIEWPORT_PAD, rect.top - PANEL_GAP - height)
      : rect.bottom + PANEL_GAP;

    setPanelStyle({ top, left, height });
  };

  useLayoutEffect(() => {
    if (!open) {
      heightRef.current = 0;
      setPanelStyle(null);
      return;
    }
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

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const t = e.target as Node;
      if (triggerRef.current?.contains(t)) return;
      if (panelRef.current?.contains(t)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (emoji: string) => {
    onPick(emoji);
    setOpen(false);
  };

  // Визуал у компактного варианта 36px, у обычного — 40px на десктопе;
  // палец в обоих случаях попадает в 44.
  const triggerClass = compact
    ? `grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px] transition-colors hover:bg-[var(--background-surface)] ${TAP_TARGET_44}`
    : `grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full sm:h-[40px] sm:w-[40px] ${TAP_TARGET_44}`;

  const panel =
    mounted && open && panelStyle ? (
      <motion.div
        ref={panelRef}
        key="emoji-panel"
        role="dialog"
        aria-label="Выбор смайла"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.12, ease: "easeOut" }}
        className="fixed z-[10000] overflow-hidden rounded-[12px] border"
        style={{
          top: panelStyle.top,
          left: panelStyle.left,
          width: Math.min(PANEL_WIDTH, window.innerWidth - VIEWPORT_PAD * 2),
          height: panelStyle.height,
          background: "var(--background-elevated)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        <div
          className="h-full overflow-y-auto overscroll-contain px-[10px] py-[10px]"
          style={{ scrollbarWidth: "thin" }}
        >
          {MESSENGER_EMOJI_GROUPS.map((group) => (
            <div key={group.label} className="mb-[8px] last:mb-0">
              <div
                className="mb-[6px] px-[4px] text-[10px] font-semibold uppercase tracking-wider"
                style={{ color: "var(--foreground-50)" }}
              >
                {group.label}
              </div>
              <div className="grid grid-cols-8 gap-[2px]">
                {group.emojis.map((emoji) => (
                  <button
                    key={emoji}
                    type="button"
                    onClick={() => pick(emoji)}
                    className="grid h-[32px] w-full place-items-center rounded-[8px] text-[20px] leading-none transition-colors hover:bg-[var(--background-surface)] active:scale-95"
                    aria-label={emoji}
                  >
                    {emoji}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </motion.div>
    ) : null;

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => {
          setOpen((v) => {
            if (v) return false;
            if (onBeforeOpen && !onBeforeOpen()) return false;
            return true;
          });
        }}
        className={triggerClass}
        style={{ color: open ? "var(--accent)" : "var(--foreground-50)" }}
        aria-label="Смайлы"
        aria-expanded={open}
        title="Смайлы"
      >
        <Smile size={compact ? 16 : 18} />
      </button>
      {mounted ? createPortal(<AnimatePresence>{panel}</AnimatePresence>, document.body) : null}
    </>
  );
}
