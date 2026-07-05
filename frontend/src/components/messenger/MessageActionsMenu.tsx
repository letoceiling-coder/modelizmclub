import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { CornerUpLeft, Copy, Forward, Pin, PinOff, Trash2, Flag, MoreHorizontal } from "lucide-react";

export interface MessageActionsMenuHandle {
  open: () => void;
}

interface Props {
  isMe: boolean;
  pinned: boolean;
  align: "left" | "right";
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onPin: () => void;
  onDelete: () => void;
  onReport: () => void;
}

export const MessageActionsMenu = forwardRef<MessageActionsMenuHandle, Props>(function MessageActionsMenu(
  { isMe, pinned, align, onReply, onCopy, onForward, onPin, onDelete, onReport },
  ref,
) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useImperativeHandle(ref, () => ({ open: () => setOpen(true) }));

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
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

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:h-[28px] sm:w-[28px] ${open ? "!opacity-100" : ""}`}
        style={{ background: "var(--background-surface)", color: "var(--foreground-50)" }}
        aria-label="Действия с сообщением"
        aria-expanded={open}
      >
        <MoreHorizontal size={16} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            role="menu"
            initial={isMobile ? { opacity: 0, y: 24 } : { opacity: 0, y: -6, scale: 0.96 }}
            animate={isMobile ? { opacity: 1, y: 0 } : { opacity: 1, y: 0, scale: 1 }}
            exit={isMobile ? { opacity: 0, y: 24 } : { opacity: 0, y: -6, scale: 0.96 }}
            transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
            className={
              isMobile
                ? "fixed inset-x-0 bottom-0 z-[90] overflow-hidden rounded-t-[16px] border pb-[max(8px,env(safe-area-inset-bottom))]"
                : `absolute top-full z-[60] mt-[6px] w-[220px] overflow-hidden rounded-[12px] border ${align === "right" ? "right-0" : "left-0"}`
            }
            style={{
              background: "var(--background-elevated)",
              borderColor: "var(--border)",
              boxShadow: "var(--shadow-float)",
            }}
          >
            <Item icon={CornerUpLeft} label="Ответить" onClick={run(onReply)} />
            <Item icon={Copy} label="Копировать" onClick={run(onCopy)} />
            <Item icon={Forward} label="Переслать" onClick={run(onForward)} />
            <Item icon={pinned ? PinOff : Pin} label={pinned ? "Открепить" : "Закрепить"} onClick={run(onPin)} />
            {isMe && <Item icon={Trash2} label="Удалить у себя" onClick={run(onDelete)} danger />}
            {!isMe && <Item icon={Flag} label="Пожаловаться" onClick={run(onReport)} />}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

function Item({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof Copy;
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
