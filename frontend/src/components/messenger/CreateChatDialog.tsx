import { useTranslation } from "@/lib/i18n";
import { useEffect, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { X, Search } from "lucide-react";
import { fetchFriends, type FriendUser } from "@/lib/api/friends";
import { avatarUrl } from "@/lib/utils/time";
import { useDebounce } from "@/hooks/useDebounce";
import { useAuth } from "@/components/auth/AuthProvider";

interface Props {
  open: boolean;
  onClose: () => void;
  onPick: (userId: string) => void;
}

export function CreateChatDialog({ open, onClose, onPick }: Props) {
  const { t } = useTranslation();
  const { isAuthenticated } = useAuth();
  const [query, setQuery] = useState("");
  const [friends, setFriends] = useState<FriendUser[]>([]);
  const debounced = useDebounce(query, 250);
  const [highlight, setHighlight] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open || !isAuthenticated) return;
    void fetchFriends().then(setFriends).catch(() => setFriends([]));
  }, [open, isAuthenticated]);

  const candidates = useMemo(() => {
    const q = debounced.trim().toLowerCase();
    return friends.filter((u) => !q || (u.display_name ?? "").toLowerCase().includes(q));
  }, [debounced, friends]);

  useEffect(() => {
    if (!open) return;
    setQuery("");
    setHighlight(0);
    const timer = setTimeout(() => inputRef.current?.focus(), 50);
    return () => clearTimeout(timer);
  }, [open]);

  const pickAt = (i: number) => {
    const u = candidates[i];
    if (u) onPick(String(u.id));
  };

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="fixed inset-0 z-[80]" style={{ background: "rgba(0,0,0,0.4)" }} onClick={onClose} />
          <motion.div
            role="dialog"
            aria-modal="true"
            className="fixed left-1/2 top-1/2 z-[81] w-[min(440px,92vw)] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-[16px] border"
            style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
          >
            <div className="flex items-center justify-between border-b px-[16px] py-[12px]" style={{ borderColor: "var(--border)" }}>
              <span className="font-semibold">{t("messenger.newChat")}</span>
              <button onClick={onClose}><X size={18} /></button>
            </div>
            <div className="p-[12px]">
              <div className="relative">
                <Search className="absolute left-[10px] top-1/2 -translate-y-1/2" size={16} style={{ color: "var(--foreground-50)" }} />
                <input ref={inputRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={t("messenger.searchUsers")} className="w-full text-[14px] outline-none" style={{ height: 40, paddingLeft: 34, background: "var(--background-surface)", borderRadius: 10, color: "var(--foreground)" }} />
              </div>
              <ul className="mt-[8px] max-h-[320px] overflow-y-auto">
                {candidates.length === 0 ? (
                  <li className="py-[24px] text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>{t("friends.emptyAll")}</li>
                ) : candidates.map((u, i) => {
                  const name = u.display_name ?? "User";
                  return (
                    <li key={u.id}>
                      <button
                        onClick={() => pickAt(i)}
                        className="flex w-full items-center gap-[10px] px-[8px] py-[8px] text-left hover:bg-[var(--background-surface)]"
                        style={{ background: i === highlight ? "var(--accent-soft)" : "transparent" }}
                      >
                        <img src={u.avatar?.url ?? avatarUrl(name)} alt="" className="h-[36px] w-[36px] rounded-full" />
                        <span className="text-[14px]">{name}</span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
