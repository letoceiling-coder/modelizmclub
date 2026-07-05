import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { User as UserIcon, UserMinus, EyeOff, Flag, Ban, MoreHorizontal } from "lucide-react";

interface Props {
  isFriend: boolean;
  onViewProfile: () => void;
  onRemoveFriend: () => void;
  onHide: () => void;
  onReport: () => void;
  onBlock: () => void;
}

export function FriendActionsMenu({ isFriend, onViewProfile, onRemoveFriend, onHide, onReport, onBlock }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const isMobile = typeof window !== "undefined" && window.innerWidth < 640;

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

  return (
    <div className="relative" ref={wrapRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="grid h-[44px] w-[44px] shrink-0 place-items-center rounded-full sm:h-[32px] sm:w-[32px]"
        style={{ color: "var(--foreground-50)" }}
        aria-label="Ещё действия"
        aria-expanded={open}
      >
        <MoreHorizontal size={18} />
      </button>

      {!isMobile && (
        <AnimatePresence>
          {open && (
            <motion.div
              role="menu"
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.18, ease: [0.22, 1, 0.36, 1] }}
              className="absolute right-0 top-full z-[60] mt-[6px] w-[220px] overflow-hidden rounded-[12px] border"
              style={{
                background: "var(--background-elevated)",
                borderColor: "var(--border)",
                boxShadow: "var(--shadow-float)",
              }}
            >
              <MenuItems
                isFriend={isFriend}
                onViewProfile={run(onViewProfile)}
                onRemoveFriend={run(onRemoveFriend)}
                onHide={run(onHide)}
                onReport={run(onReport)}
                onBlock={run(onBlock)}
              />
            </motion.div>
          )}
        </AnimatePresence>
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
                    isFriend={isFriend}
                    onViewProfile={run(onViewProfile)}
                    onRemoveFriend={run(onRemoveFriend)}
                    onHide={run(onHide)}
                    onReport={run(onReport)}
                    onBlock={run(onBlock)}
                  />
                </motion.div>
              </>
            )}
          </AnimatePresence>,
          document.body,
        )}
    </div>
  );
}

function MenuItems({
  isFriend,
  onViewProfile,
  onRemoveFriend,
  onHide,
  onReport,
  onBlock,
}: {
  isFriend: boolean;
  onViewProfile: () => void;
  onRemoveFriend: () => void;
  onHide: () => void;
  onReport: () => void;
  onBlock: () => void;
}) {
  return (
    <>
      <Item icon={UserIcon} label="Смотреть профиль" onClick={onViewProfile} />
      {isFriend && <Item icon={UserMinus} label="Удалить из друзей" onClick={onRemoveFriend} />}
      <Item icon={EyeOff} label="Скрыть из рекомендаций" onClick={onHide} />
      <Item icon={Flag} label="Пожаловаться" onClick={onReport} />
      <div className="border-t" style={{ borderColor: "var(--border)" }} />
      <Item icon={Ban} label="Заблокировать" onClick={onBlock} danger />
    </>
  );
}

function Item({
  icon: Icon,
  label,
  onClick,
  danger,
}: {
  icon: typeof UserIcon;
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
