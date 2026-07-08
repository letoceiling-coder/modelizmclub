import { useEffect, useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  PanelRightClose, PanelRightOpen, ChevronRight, ChevronDown,
  Car, Plane, Ship, Send, Code2, Wrench, Cpu, BatteryCharging, Users, Hash,
} from "lucide-react";
import * as Icons from "lucide-react";
import type { Community, User } from "@/lib/mock";
import { usePostCategories } from "@/lib/hooks/useCategories";
import { onlineFor } from "@/lib/category-online";
import { fetchCommunities } from "@/lib/api/communities";
import { searchUsers } from "@/lib/api/social";
import { useStore } from "@/lib/store";
import { Skeleton } from "@/components/ui/skeleton";

const COLLAPSE_KEY = "modelizm:feedrail:collapsed";

const COMMUNITY_ICON_MAP: Record<string, typeof Car> = {
  Car, Plane, Ship, Send, Code2, Wrench, Cpu, BatteryCharging,
};

function CategoryIcon({ name, className }: { name: string; className?: string }) {
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ className?: string }>>)[name] ??
    Hash;
  return <Icon className={className} />;
}

function RailCard({ children }: { children: React.ReactNode }) {
  return (
    <div
      className="overflow-hidden rounded-[14px] border"
      style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
    >
      {children}
    </div>
  );
}

function CardHeader({ title, to, onCollapse }: { title: string; to: string; onCollapse?: () => void }) {
  return (
    <div className="flex items-center justify-between gap-2 border-b px-[14px] py-[11px]" style={{ borderColor: "var(--border)" }}>
      <h3 className="text-[13.5px] font-semibold" style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}>
        {title}
      </h3>
      <div className="flex items-center gap-[2px]">
        <Link
          to={to}
          className="flex items-center gap-[2px] text-[12px] transition-colors hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          Все <ChevronRight className="h-[13px] w-[13px]" />
        </Link>
        {onCollapse && (
          <button
            type="button"
            onClick={onCollapse}
            aria-label="Свернуть панель"
            className="grid h-[26px] w-[26px] shrink-0 place-items-center rounded-[8px] transition-colors hover:bg-[var(--background-surface)]"
            style={{ color: "var(--foreground-50)" }}
          >
            <PanelRightClose className="h-[15px] w-[15px]" />
          </button>
        )}
      </div>
    </div>
  );
}

function SkeletonRows({ n }: { n: number }) {
  return (
    <div className="space-y-[10px] p-[10px]">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-[10px]">
          <Skeleton className="h-[30px] w-[30px] shrink-0 rounded-[8px]" />
          <div className="flex-1 space-y-[6px]">
            <Skeleton className="h-[10px] rounded-[6px]" style={{ width: `${55 + (i * 13) % 30}%` }} />
            <Skeleton className="h-[9px] rounded-[6px]" style={{ width: `${35 + (i * 11) % 25}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function FeedRightRail() {
  const [openId, setOpenId] = useState<string | null>(null);
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(COLLAPSE_KEY) === "1";
  });

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
  }, [collapsed]);

  const categories = usePostCategories();
  const blockedUserIds = useStore((s) => s.blockedUserIds);

  const [communities, setCommunities] = useState<Community[] | null>(null);
  const [people, setPeople] = useState<User[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetchCommunities()
      .then((cs) => { if (alive) setCommunities(cs.filter((c) => !c.joined).slice(0, 3)); })
      .catch(() => { if (alive) setCommunities([]); });
    searchUsers("")
      .then((us) => { if (alive) setPeople(us.slice(0, 6)); })
      .catch(() => { if (alive) setPeople([]); });
    return () => { alive = false; };
  }, []);

  if (collapsed) {
    return (
      <aside className="hidden xl:flex w-11 shrink-0 justify-center pt-4">
        <button
          type="button"
          onClick={() => setCollapsed(false)}
          aria-label="Развернуть панель"
          className="grid h-9 w-9 place-items-center rounded-[10px] border transition-colors hover:bg-[var(--background-surface)]"
          style={{ background: "var(--background-elevated)", borderColor: "var(--border)", color: "var(--foreground-70)" }}
        >
          <PanelRightOpen className="h-[18px] w-[18px]" />
        </button>
      </aside>
    );
  }

  const topCategories = categories.slice(0, 5);
  const suggestedPeople = (people ?? []).filter((u) => !blockedUserIds.includes(u.id)).slice(0, 3);

  return (
    <aside className="hidden xl:block w-64 shrink-0">
      <div className="flex h-full flex-col gap-[12px] overflow-y-auto pb-4" style={{ scrollbarWidth: "thin" }}>

        {/* Card 1 — Категории */}
        <RailCard>
          <CardHeader title="Категории" to="/categories" onCollapse={() => setCollapsed(true)} />
          <ul className="p-[6px]">
            {topCategories.map((c) => {
              const online = onlineFor(c);
              const open = openId === c.id;
              const hasSubs = c.subcategories.length > 0;
              return (
                <li key={c.id}>
                  <div className="flex items-stretch">
                    <Link
                      to="/categories/$id"
                      params={{ id: c.id }}
                      className={`flex flex-1 items-center gap-[10px] py-[8px] pl-[10px] transition-colors hover:bg-[var(--background-surface)] ${hasSubs ? "rounded-l-[10px] pr-[4px]" : "rounded-[10px] pr-[10px]"}`}
                    >
                      <span
                        className="grid h-[28px] w-[28px] shrink-0 place-items-center rounded-[8px]"
                        style={{ background: "var(--background-surface)", color: "var(--accent)" }}
                      >
                        <CategoryIcon name={c.icon} className="h-[14px] w-[14px]" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium" style={{ color: "var(--foreground)" }}>
                          {c.name}
                        </span>
                        <span className="mt-[1px] flex items-center gap-[5px] text-[11px]" style={{ color: "var(--foreground-50)" }}>
                          <span className="inline-block h-[6px] w-[6px] rounded-full" style={{ background: "#22c55e" }} />
                          {online} онлайн
                        </span>
                      </span>
                    </Link>
                    {hasSubs && (
                      <button
                        type="button"
                        onClick={() => setOpenId(open ? null : c.id)}
                        aria-label={open ? "Свернуть подкатегории" : "Развернуть подкатегории"}
                        aria-expanded={open}
                        className="grid w-[28px] shrink-0 place-items-center rounded-r-[10px] transition-colors hover:bg-[var(--background-surface)]"
                      >
                        <ChevronDown
                          className={`h-[14px] w-[14px] transition-transform ${open ? "rotate-180" : ""}`}
                          style={{ color: "var(--foreground-50)" }}
                        />
                      </button>
                    )}
                  </div>

                  {open && hasSubs && (
                    <ul
                      className="mb-[4px] ml-[36px] mt-[2px] space-y-[1px] border-l pl-[10px]"
                      style={{ borderColor: "var(--border)" }}
                    >
                      {c.subcategories.map((s) => (
                        <li key={s.id}>
                          <Link
                            to="/categories/$id/$subId"
                            params={{ id: c.id, subId: s.id }}
                            className="block rounded-[6px] px-[8px] py-[5px] text-[12.5px] transition-colors hover:bg-[var(--background-surface)]"
                            style={{ color: "var(--foreground-70)" }}
                          >
                            {s.name}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        </RailCard>

        {/* Card 2 — Сообщества для вас */}
        {communities === null ? (
          <RailCard>
            <CardHeader title="Сообщества" to="/communities" />
            <SkeletonRows n={3} />
          </RailCard>
        ) : communities.length > 0 ? (
          <RailCard>
            <CardHeader title="Сообщества" to="/communities" />
            <ul className="p-[6px]">
              {communities.map((c) => {
                const Icon = COMMUNITY_ICON_MAP[c.avatarIcon ?? "Users"] ?? Users;
                return (
                  <li key={c.id}>
                    <Link
                      to="/communities/$id"
                      params={{ id: c.id }}
                      className="flex items-center gap-[10px] rounded-[10px] px-[10px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
                    >
                      <span
                        className="grid h-[30px] w-[30px] shrink-0 place-items-center overflow-hidden rounded-[8px]"
                        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
                      >
                        {c.avatarImage ? (
                          <img src={c.avatarImage} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <Icon className="h-[15px] w-[15px]" />
                        )}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-medium" style={{ color: "var(--foreground)" }}>
                          {c.name}
                        </span>
                        <span className="mt-[1px] block text-[11px]" style={{ color: "var(--foreground-50)" }}>
                          {c.members.toLocaleString("ru")} участников
                        </span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          </RailCard>
        ) : null}

        {/* Card 3 — Возможные друзья */}
        {people === null ? (
          <RailCard>
            <CardHeader title="Возможные друзья" to="/friends" />
            <SkeletonRows n={3} />
          </RailCard>
        ) : suggestedPeople.length > 0 ? (
          <RailCard>
            <CardHeader title="Возможные друзья" to="/friends" />
            <ul className="p-[6px]">
              {suggestedPeople.map((u) => (
                <li key={u.id}>
                  <Link
                    to="/user/$id"
                    params={{ id: u.slug ?? u.id }}
                    className="flex items-center gap-[10px] rounded-[10px] px-[10px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
                  >
                    <img src={u.avatar} alt="" className="h-[30px] w-[30px] shrink-0 rounded-full object-cover" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13.5px] font-medium" style={{ color: "var(--foreground)" }}>
                        {u.name}
                      </span>
                      <span className="mt-[1px] block truncate text-[11px]" style={{ color: "var(--foreground-50)" }}>
                        {u.city}
                      </span>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </RailCard>
        ) : null}

      </div>
    </aside>
  );
}
