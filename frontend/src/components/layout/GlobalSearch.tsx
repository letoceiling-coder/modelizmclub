import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { Search, User as UserIcon, Users2, Megaphone, Compass } from "lucide-react";
import { useGlobalSearch, MIN_QUERY_LENGTH } from "@/lib/hooks/useGlobalSearch";
import { SearchGroup, ResultRow } from "@/components/layout/search/SearchResultRow";

/** Header search — live dropdown split by content type (люди, сообщества,
 *  объявления, направления), VK-style. Replaces the old behavior of only
 *  ever being able to search ads via a catalog redirect. */
export function GlobalSearch() {
  const navigate = useNavigate();
  const [value, setValue] = useState("");
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const q = value.trim();
  const { results, loading } = useGlobalSearch(q);

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
