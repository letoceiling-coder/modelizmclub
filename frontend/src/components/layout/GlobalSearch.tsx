import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "@tanstack/react-router";
import { Search, User as UserIcon, Users2, Megaphone, Compass } from "lucide-react";
import { searchUsers } from "@/lib/api/social";
import { fetchCommunities } from "@/lib/api/communities";
import { fetchListings } from "@/lib/api/listings";
import { fetchListingCategories } from "@/lib/api/categories";
import type { User, Community, Ad, Category } from "@/lib/mock";

interface SearchResults {
  users: User[];
  communities: Community[];
  ads: Ad[];
  categories: Category[];
}

const EMPTY: SearchResults = { users: [], communities: [], ads: [], categories: [] };
const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;

function SearchGroup({
  label,
  icon: Icon,
  children,
}: {
  label: string;
  icon: typeof UserIcon;
  children: React.ReactNode;
}) {
  return (
    <div className="py-[6px]">
      <div
        className="flex items-center gap-[6px] px-[14px] py-[4px] text-[11px] font-semibold uppercase tracking-wide"
        style={{ color: "var(--foreground-50)" }}
      >
        <Icon size={12} />
        {label}
      </div>
      {children}
    </div>
  );
}

function ResultRow({
  to,
  params,
  avatar,
  fallbackIcon: FallbackIcon,
  title,
  subtitle,
  onNavigate,
}: {
  to: string;
  params?: Record<string, string>;
  search?: Record<string, string>;
  avatar?: string;
  fallbackIcon: typeof UserIcon;
  title: string;
  subtitle?: string;
  onNavigate: () => void;
}) {
  return (
    <Link
      to={to}
      params={params}
      onClick={onNavigate}
      className="flex items-center gap-[10px] px-[14px] py-[8px] transition-colors hover:bg-[var(--background-surface)]"
    >
      {avatar ? (
        <img src={avatar} alt="" className="h-[32px] w-[32px] shrink-0 rounded-full object-cover" />
      ) : (
        <div
          className="grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <FallbackIcon size={16} />
        </div>
      )}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[13px] font-medium" style={{ color: "var(--foreground)" }}>{title}</div>
        {subtitle && (
          <div className="truncate text-[12px]" style={{ color: "var(--foreground-50)" }}>{subtitle}</div>
        )}
      </div>
    </Link>
  );
}

/** Header search — live dropdown split by content type (люди, сообщества,
 *  объявления, направления), VK-style. Replaces the old behavior of only
 *  ever being able to search ads via a catalog redirect. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const requestId = useRef(0);

  const q = value.trim();

  useEffect(() => {
    if (q.length < MIN_QUERY_LENGTH) {
      setResults(EMPTY);
      setLoading(false);
      return;
    }
    const id = ++requestId.current;
    setLoading(true);
    const timer = setTimeout(() => {
      Promise.all([
        searchUsers(q).catch(() => []),
        fetchCommunities(q).catch(() => []),
        fetchListings({ q, perPage: 5 }).catch(() => []),
        fetchListingCategories().catch(() => []),
      ]).then(([users, communities, ads, allCategories]) => {
        if (id !== requestId.current) return;
        const qLower = q.toLowerCase();
        const categories = allCategories.filter((c) => c.name.toLowerCase().includes(qLower)).slice(0, 5);
        setResults({ users: users.slice(0, 4), communities: communities.slice(0, 4), ads: ads.slice(0, 5), categories });
        setLoading(false);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const hasAny =
    results.users.length > 0 || results.communities.length > 0 || results.ads.length > 0 || results.categories.length > 0;

  const goToCatalog = () => {
    setOpen(false);
    void navigate({ to: "/ads", search: q ? { q } : {} });
  };

  return (
    <div className="relative min-w-0 max-w-[420px] flex-1" ref={containerRef}>
      <Search
        size={16}
        className="pointer-events-none absolute left-[12px] top-1/2 -translate-y-1/2"
        style={{ color: "var(--foreground-50)" }}
      />
      <input
        type="search"
        placeholder="Поиск по сайту"
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter") goToCatalog();
          if (e.key === "Escape") setOpen(false);
        }}
        className="w-full text-[14px] outline-none transition-colors"
        style={{
          background: "var(--background-elevated)",
          color: "var(--foreground)",
          border: "1px solid var(--border)",
          borderRadius: "var(--r-input)",
          height: 40,
          padding: "0 12px 0 36px",
        }}
      />

      {open && q.length >= MIN_QUERY_LENGTH && (
        <div
          className="absolute left-0 right-0 top-[calc(100%+6px)] z-50 max-h-[70vh] overflow-y-auto"
          style={{
            background: "var(--background-elevated)",
            border: "1px solid var(--border)",
            borderRadius: "var(--r-card)",
            boxShadow: "var(--shadow-float)",
          }}
        >
          {!hasAny ? (
            <div className="px-[14px] py-[14px] text-[13px]" style={{ color: "var(--foreground-50)" }}>
              {loading ? "Ищем…" : "Ничего не найдено"}
            </div>
          ) : (
            <>
              {results.categories.length > 0 && (
                <SearchGroup label="Направления" icon={Compass}>
                  {results.categories.map((c) => (
                    <ResultRow
                      key={c.id}
                      to="/categories/$id"
                      params={{ id: c.id }}
                      fallbackIcon={Compass}
                      title={c.name}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </SearchGroup>
              )}
              {results.users.length > 0 && (
                <SearchGroup label="Люди" icon={UserIcon}>
                  {results.users.map((u) => (
                    <ResultRow
                      key={u.id}
                      to="/user/$id"
                      params={{ id: u.slug ?? u.id }}
                      avatar={u.avatar}
                      fallbackIcon={UserIcon}
                      title={u.name}
                      subtitle={u.city}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </SearchGroup>
              )}
              {results.communities.length > 0 && (
                <SearchGroup label="Сообщества" icon={Users2}>
                  {results.communities.map((c) => (
                    <ResultRow
                      key={c.id}
                      to="/communities/$id"
                      params={{ id: c.id }}
                      avatar={c.avatarImage}
                      fallbackIcon={Users2}
                      title={c.name}
                      subtitle={`${c.members} участников`}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </SearchGroup>
              )}
              {results.ads.length > 0 && (
                <SearchGroup label="Объявления" icon={Megaphone}>
                  {results.ads.map((ad) => (
                    <ResultRow
                      key={ad.id}
                      to="/ads/$id"
                      params={{ id: ad.id }}
                      avatar={ad.image}
                      fallbackIcon={Megaphone}
                      title={ad.title}
                      subtitle={`${ad.price.toLocaleString("ru-RU")} ₽`}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </SearchGroup>
              )}
            </>
          )}
          <button
            type="button"
            onClick={goToCatalog}
            className="w-full px-[14px] py-[10px] text-left text-[13px] font-medium transition-colors hover:bg-[var(--background-surface)]"
            style={{ borderTop: "1px solid var(--border)", color: "var(--accent)" }}
          >
            Все объявления по запросу «{q}»
          </button>
        </div>
      )}
    </div>
  );
}
