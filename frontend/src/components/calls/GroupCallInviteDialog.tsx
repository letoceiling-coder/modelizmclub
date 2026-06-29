import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X, Check, Video, Phone, Users } from "lucide-react";
import { fetchFriends, searchUsers } from "@/lib/api/social";
import type { User } from "@/lib/mock";
import { useStore, selectors } from "@/lib/store";
import { groupCalls, useGroupCall, type GroupMedia } from "@/lib/groupCall";

export function GroupCallInviteDialog() {
  const picker = useGroupCall((s) => s.picker);
  const me = useStore(selectors.currentUser);
  const [mounted, setMounted] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);
  const [all, setAll] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [q, setQ] = useState("");
  const [tab, setTab] = useState<"friends" | "online">("friends");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [media, setMedia] = useState<GroupMedia>("video");

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!picker) return;
    setSelected(new Set(picker.preselect));
    setQ("");
    setTab("friends");
    setMedia("video");
    setLoading(true);
    Promise.all([
      fetchFriends().catch(() => [] as User[]),
      searchUsers("").catch(() => [] as User[]),
    ]).then(([fr, us]) => {
      setFriends(fr);
      setAll(us);
      setLoading(false);
    });
  }, [picker]);

  const onlineMap = useMemo(() => {
    const m = new Map<string, boolean>();
    all.forEach((u) => m.set(u.id, !!u.online));
    return m;
  }, [all]);

  const byId = useMemo(() => {
    const m = new Map<string, User>();
    [...friends, ...all].forEach((u) => m.set(u.id, u));
    return m;
  }, [friends, all]);

  const list = useMemo(() => {
    const ql = q.trim().toLowerCase();
    let base: User[];
    if (ql) base = all.filter((u) => u.name.toLowerCase().includes(ql) || (u.interests ?? "").toLowerCase().includes(ql));
    else if (tab === "online") base = all.filter((u) => u.online);
    else base = friends.length ? friends : all;
    return base.filter((u) => !me || u.id !== me.id);
  }, [q, tab, friends, all, me]);

  if (!mounted || !picker) return null;

  const toggle = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectedUsers = [...selected].map((id) => byId.get(id)).filter(Boolean) as User[];

  const confirm = () => {
    const ids = [...selected];
    if (ids.length === 0) return;
    if (picker.mode === "invite") void groupCalls.inviteMore(ids, media);
    else void groupCalls.start(ids, media);
    groupCalls.closePicker();
  };

  const isInvite = picker.mode === "invite";

  return createPortal(
    <AnimatePresence>
      <motion.div
        key="gc-picker"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[10000] flex items-end sm:items-center justify-center"
        style={{ background: "rgba(0,0,0,0.5)", backdropFilter: "blur(2px)" }}
        onClick={() => groupCalls.closePicker()}
      >
        <motion.div
          initial={{ y: 30, opacity: 0, scale: 0.98 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 20, opacity: 0 }}
          transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
          onClick={(e) => e.stopPropagation()}
          className="flex max-h-[85dvh] w-full max-w-[460px] flex-col overflow-hidden rounded-t-[18px] sm:rounded-[18px]"
          style={{ background: "var(--background-elevated)", border: "1px solid var(--border)", boxShadow: "var(--shadow-float)" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-[18px] pt-[16px] pb-[12px]">
            <div className="flex items-center gap-[10px]">
              <span className="grid h-[34px] w-[34px] place-items-center rounded-full" style={{ background: "color-mix(in oklab, var(--accent) 18%, transparent)", color: "var(--accent)" }}>
                <Users size={18} />
              </span>
              <div>
                <div className="font-display text-[16px] font-bold" style={{ color: "var(--foreground)" }}>
                  {isInvite ? "Пригласить в звонок" : "Групповой звонок"}
                </div>
                <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                  {isInvite ? "Выберите, кого добавить" : "Выберите участников"}
                </div>
              </div>
            </div>
            <button type="button" onClick={() => groupCalls.closePicker()} className="grid h-[32px] w-[32px] place-items-center rounded-full hover:bg-[var(--background-surface)]" style={{ color: "var(--foreground-50)" }} aria-label="Закрыть">
              <X size={18} />
            </button>
          </div>

          {/* Selected chips */}
          {selectedUsers.length > 0 && (
            <div className="flex flex-wrap gap-[6px] px-[18px] pb-[10px]">
              {selectedUsers.map((u) => (
                <button key={u.id} type="button" onClick={() => toggle(u.id)} className="inline-flex items-center gap-[6px] rounded-full py-[4px] pl-[4px] pr-[10px] text-[12px]" style={{ background: "var(--background-surface)", color: "var(--foreground)" }}>
                  <img src={u.avatar} alt="" className="h-[20px] w-[20px] rounded-full object-cover" />
                  {u.name}
                  <X size={12} style={{ color: "var(--foreground-50)" }} />
                </button>
              ))}
            </div>
          )}

          {/* Tabs + search */}
          <div className="flex items-center gap-[8px] px-[18px]">
            {(["friends", "online"] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTab(t)}
                className="rounded-full px-[12px] py-[5px] text-[12px] font-medium transition-colors"
                style={{
                  background: tab === t ? "var(--accent)" : "var(--background-surface)",
                  color: tab === t ? "white" : "var(--foreground-70)",
                }}
              >
                {t === "friends" ? "Друзья" : "Онлайн"}
              </button>
            ))}
          </div>
          <div className="relative px-[18px] pt-[10px]">
            <Search className="pointer-events-none absolute left-[30px] top-1/2 -translate-y-1/2" size={15} style={{ color: "var(--foreground-50)" }} />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Поиск людей"
              className="w-full text-[14px] outline-none"
              style={{ height: 38, paddingLeft: 30, paddingRight: 12, background: "var(--background-surface)", borderRadius: 10, border: "1.5px solid transparent", color: "var(--foreground)" }}
              onFocus={(e) => { e.currentTarget.style.borderColor = "var(--accent)"; }}
              onBlur={(e) => { e.currentTarget.style.borderColor = "transparent"; }}
            />
          </div>

          {/* List */}
          <div className="mt-[10px] min-h-0 flex-1 overflow-y-auto px-[8px] pb-[8px]">
            {loading ? (
              <div className="py-[40px] text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>Загрузка…</div>
            ) : list.length === 0 ? (
              <div className="py-[40px] text-center text-[13px]" style={{ color: "var(--foreground-50)" }}>Никого не найдено</div>
            ) : (
              list.map((u) => {
                const on = onlineMap.get(u.id);
                const checked = selected.has(u.id);
                return (
                  <button
                    key={u.id}
                    type="button"
                    onClick={() => toggle(u.id)}
                    className="flex w-full items-center gap-[12px] rounded-[12px] px-[10px] py-[8px] text-left transition-colors hover:bg-[var(--background-surface)]"
                  >
                    <span className="relative shrink-0">
                      <img src={u.avatar} alt="" className="h-[40px] w-[40px] rounded-full object-cover" />
                      {on && <span className="absolute bottom-0 right-0 h-[10px] w-[10px] rounded-full" style={{ background: "var(--success)", border: "2px solid var(--background-elevated)" }} />}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium" style={{ color: "var(--foreground)" }}>{u.name}</span>
                      {u.city && <span className="block truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>{u.city}</span>}
                    </span>
                    <span className="grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full" style={{ background: checked ? "var(--accent)" : "transparent", border: checked ? "none" : "2px solid var(--border)", color: "white" }}>
                      {checked && <Check size={14} />}
                    </span>
                  </button>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="flex items-center gap-[10px] border-t px-[18px] py-[12px]" style={{ borderColor: "var(--border)" }}>
            {!isInvite && (
              <div className="flex items-center gap-[4px] rounded-full p-[3px]" style={{ background: "var(--background-surface)" }}>
                <button type="button" onClick={() => setMedia("video")} className="grid h-[30px] w-[34px] place-items-center rounded-full" style={{ background: media === "video" ? "var(--accent)" : "transparent", color: media === "video" ? "white" : "var(--foreground-50)" }} aria-label="Видео">
                  <Video size={16} />
                </button>
                <button type="button" onClick={() => setMedia("audio")} className="grid h-[30px] w-[34px] place-items-center rounded-full" style={{ background: media === "audio" ? "var(--accent)" : "transparent", color: media === "audio" ? "white" : "var(--foreground-50)" }} aria-label="Только звук">
                  <Phone size={16} />
                </button>
              </div>
            )}
            <button
              type="button"
              disabled={selected.size === 0}
              onClick={confirm}
              className="flex-1 rounded-[10px] py-[11px] text-center text-[14px] font-semibold transition-opacity"
              style={{ background: "var(--accent)", color: "white", opacity: selected.size === 0 ? 0.5 : 1 }}
            >
              {isInvite ? `Пригласить${selected.size ? ` (${selected.size})` : ""}` : `Начать звонок${selected.size ? ` (${selected.size})` : ""}`}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body,
  );
}
