import { useEffect, useRef, useState } from "react";
import { useNavigate } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Search, User as UserIcon, Users2, Megaphone, Compass } from "lucide-react";
import { useGlobalSearch, MIN_QUERY_LENGTH } from "@/lib/hooks/useGlobalSearch";
import { SearchGroup, ResultRow } from "@/components/layout/search/SearchResultRow";
import { useFeatureFlag } from "@/lib/config/featureFlags";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";

/** Header search — live dropdown split by content type (люди, сообщества,
 *  объявления, направления), VK-style. Replaces the old behavior of only
 *  ever being able to search ads via a catalog redirect. */
export function GlobalSearch() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const communitiesEnabled = useFeatureFlag("communitiesEnabled");
  const { isAllowed, guardAction } = useGuestAccess();
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
    results.users.length > 0
    || (communitiesEnabled && results.communities.length > 0)
    || results.ads.length > 0
    || results.categories.length > 0;

  const goToCatalog = () => {
    setOpen(false);
    void navigate({ to: "/ads", search: q ? { q } : {} });
  };

  const promptSearchAuth = (e: { preventDefault: () => void }) => {
    if (isAllowed("layout.header.search")) return;
    e.preventDefault();
    guardAction("layout.header.search", () => {});
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
        placeholder={t("search.placeholder")}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          setOpen(true);
        }}
        readOnly={!isAllowed("layout.header.search")}
        onPointerDown={promptSearchAuth}
        onFocus={(e) => {
          promptSearchAuth(e);
          if (isAllowed("layout.header.search")) setOpen(true);
        }}
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
              {loading ? t("search.searching") : t("pages.shared.nothingFound")}
            </div>
          ) : (
            <>
              {results.categories.length > 0 && (
                <SearchGroup label={t("search.groups.categories")} icon={Compass}>
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
                <SearchGroup label={t("search.groups.users")} icon={UserIcon}>
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
              {communitiesEnabled && results.communities.length > 0 && (
                <SearchGroup label={t("search.groups.communities")} icon={Users2}>
                  {results.communities.map((c) => (
                    <ResultRow
                      key={c.id}
                      to="/communities/$id"
                      params={{ id: c.id }}
                      avatar={c.avatarImage}
                      fallbackIcon={Users2}
                      title={c.name}
                      subtitle={t("pages.shared.members", { count: c.members })}
                      onNavigate={() => setOpen(false)}
                    />
                  ))}
                </SearchGroup>
              )}
              {results.ads.length > 0 && (
                <SearchGroup label={t("search.groups.ads")} icon={Megaphone}>
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
            {t("search.allAdsForQuery", { q })}
          </button>
        </div>
      )}
    </div>
  );
}
