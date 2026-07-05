import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from "react";
import { createPortal } from "react-dom";
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

const DESKTOP_MENU_WIDTH = 220;

export const MessageActionsMenu = forwardRef<MessageActionsMenuHandle, Props>(function MessageActionsMenu(
  { isMe, pinned, align, onReply, onCopy, onForward, onPin, onDelete, onReport },
  ref,
) {
  const [open, setOpen] = useState(false);
  const [desktopPos, setDesktopPos] = useState<{ top: number; left: number } | null>(null);
  const wrapRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);

  const computeDesktopPos = () => {
    const btn = triggerRef.current;
    if (!btn) return;
    const r = btn.getBoundingClientRect();
    const left = align === "right" ? r.right - DESKTOP_MENU_WIDTH : r.left;
    setDesktopPos({ top: r.bottom + 6, left });
  };

  const openMenu = () => {
    computeDesktopPos();
    setOpen(true);
  };

  useImperativeHandle(ref, () => ({ open: openMenu }));

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      const target = e.target as Node;
      if (wrapRef.current?.contains(target)) return;
      if (menuElRef.current?.contains(target)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onScrollOrResize = () => setOpen(false);
    document.addEventListener("mousedown", onClick);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScrollOrResize, true);
    window.addEventListener("resize", onScrollOrResize);
    return () => {
      document.removeEventListener("mousedown", onClick);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScrollOrResize, true);
      window.removeEventListener("resize", onScrollOrResize);
    };
  }, [open]);

  const menuElRef = useRef<HTMLDivElement>(null);

  const run = (fn: () => void) => () => {
    setOpen(false);
    fn();
  };
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

  return (
    <>
    <div className="relative" ref={wrapRef}>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => (open ? setOpen(false) : openMenu())}
        className={`grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full opacity-0 transition-opacity duration-150 group-hover:opacity-100 sm:h-[28px] sm:w-[28px] ${open ? "!opacity-100" : ""}`}
        style={{ background: "var(--background-surface)", color: "var(--foreground-50)" }}
        aria-label="Действия с сообщением"
        aria-expanded={open}
      >
        <MoreHorizontal size={16} />
      </button>
    </div>

    {!isMobile &&
      typeof document !== "undefined" &&
      createPortal(
        <AnimatePresence>
          {open && desktopPos && (
            <motion.div
              ref={menuElRef}
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="fixed z-[100] overflow-hidden rounded-[12px] border"
              style={{
                top: desktopPos.top,
                left: desktopPos.left,
                width: DESKTOP_MENU_WIDTH,
                background: "var(--background-elevated)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-float)",
              }}
            >
              <MenuItems
                isMe={isMe}
                pinned={pinned}
                onReply={run(onReply)}
                onCopy={run(onCopy)}
                onForward={run(onForward)}
                onPin={run(onPin)}
                onDelete={run(onDelete)}
                onReport={run(onReport)}
              />
            </motion.div>
          )}
        </AnimatePresence>,
        document.body,
      )}

    {isMobile &&
      typeof document !== "undefined" &&
      createPortal(
        <AnimatePresence>
          {open && (
            <>
              <motion.div
                key="overlay"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.16 }}
                className="fixed inset-0 z-[89]"
                style={{ background: "rgba(0,0,0,0.4)" }}
                onClick={() => setOpen(false)}
              />
              <motion.div
                role="menu"
                initial={{ opacity: 0, y: 24 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: 24 }}
                transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
                className="fixed inset-x-0 bottom-0 z-[90] overflow-hidden rounded-t-[16px] border pb-[max(8px,env(safe-area-inset-bottom))]"
                style={{
                  background: "var(--background-elevated)",
                  borderColor: "var(--border)",
                  boxShadow: "var(--shadow-float)",
                }}
              >
                <MenuItems
                  isMe={isMe}
                  pinned={pinned}
                  onReply={run(onReply)}
                  onCopy={run(onCopy)}
                  onForward={run(onForward)}
                  onPin={run(onPin)}
                  onDelete={run(onDelete)}
                  onReport={run(onReport)}
                />
              </motion.div>
            </>
          )}
        </AnimatePresence>,
        document.body,
      )}
  </>
  );
});

function MenuItems({
  isMe,
  pinned,
  onReply,
  onCopy,
  onForward,
  onPin,
  onDelete,
  onReport,
}: {
  isMe: boolean;
  pinned: boolean;
  onReply: () => void;
  onCopy: () => void;
  onForward: () => void;
  onPin: () => void;
  onDelete: () => void;
  onReport: () => void;
}) {
  return (
    <>
      <Item icon={CornerUpLeft} label="Ответить" onClick={onReply} />
      <Item icon={Copy} label="Копировать" onClick={onCopy} />
      <Item icon={Forward} label="Переслать" onClick={onForward} />
      <Item icon={pinned ? PinOff : Pin} label={pinned ? "Открепить" : "Закрепить"} onClick={onPin} />
      {isMe && <Item icon={Trash2} label="Удалить у себя" onClick={onDelete} danger />}
      {!isMe && <Item icon={Flag} label="Пожаловаться" onClick={onReport} />}
    </>
  );
}

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
