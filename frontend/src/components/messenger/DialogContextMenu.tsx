import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { BellOff, Bell, Pin, PinOff, MailQuestion, Trash2 } from "lucide-react";

interface Point {
  x: number;
  y: number;
}

interface Props {
  point: Point | null;
  onClose: () => void;
  pinned: boolean;
  muted: boolean;
  onMarkUnread: () => void;
  onTogglePin: () => void;
  onToggleMute: () => void;
  onClearHistory: () => void;
  onDeleteChat: () => void;
}

const MENU_WIDTH = 230;
const MENU_HEIGHT_ESTIMATE = 200;

export function DialogContextMenu({
  point,
  onClose,
  pinned,
  muted,
  onMarkUnread,
  onTogglePin,
  onToggleMute,
  onClearHistory,
  onDeleteChat,
}: Props) {
  const menuRef = useRef<HTMLDivElement>(null);
  const open = Boolean(point);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) onClose();
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onScrollOrResize = () => onClose();
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open, onClose]);

  if (typeof document === "undefined") return null;

  const style = point
    ? {
        top: Math.min(point.y, window.innerHeight - MENU_HEIGHT_ESTIMATE),
        left: Math.min(point.x, window.innerWidth - MENU_WIDTH - 8),
        width: MENU_WIDTH,
      }
    : undefined;

  const run = (fn: () => void) => () => {
    onClose();
    fn();
  };

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={menuRef}
          role="menu"
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.96 }}
          transition={{ duration: 0.15, ease: [0.22, 1, 0.36, 1] }}
          className="fixed z-[100] overflow-hidden rounded-[12px] border"
          style={{
            ...style,
            background: "var(--background-elevated)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-float)",
          }}
        >
          <Item icon={MailQuestion} label="Отметить непрочитанным" onClick={run(onMarkUnread)} />
          <Item
            icon={pinned ? PinOff : Pin}
            label={pinned ? "Открепить чат" : "Закрепить чат"}
            onClick={run(onTogglePin)}
          />
          <Item
            icon={muted ? Bell : BellOff}
            label={muted ? "Включить уведомления" : "Отключить уведомления"}
            onClick={run(onToggleMute)}
          />
          <Item icon={Trash2} label="Очистить историю" onClick={run(onClearHistory)} danger />
          <Item icon={Trash2} label="Удалить чат" onClick={run(onDeleteChat)} danger />
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Item({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Pin;
  label: string;
  onClick: () => void;
  danger?: boolean;
}) {
  return (
    <button
      role="menuitem"
      type="button"
      onClick={onClick}
      className="flex w-full items-center gap-[10px] px-[14px] py-[12px] text-left text-[13px] transition-colors hover:bg-[var(--background-surface)]"
      style={{ color: danger ? "var(--error)" : "var(--foreground)" }}
    >
      <Icon className="h-[16px] w-[16px]" />
      {label}
    </button>
  );
}
