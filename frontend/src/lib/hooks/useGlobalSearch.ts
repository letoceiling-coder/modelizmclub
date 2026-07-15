import { useEffect, useRef, useState } from "react";
import { searchUsers } from "@/lib/api/social";
import { fetchCommunities } from "@/lib/api/communities";
import { fetchListings } from "@/lib/api/listings";
import { fetchListingCategories } from "@/lib/api/categories";
import type { User, Community, Ad, Category } from "@/lib/mock";

export interface SearchResults {
  users: User[];
  communities: Community[];
  ads: Ad[];
  categories: Category[];
}

const EMPTY: SearchResults = { users: [], communities: [], ads: [], categories: [] };
export const MIN_QUERY_LENGTH = 2;
const DEBOUNCE_MS = 300;
const DEFAULT_PER_PAGE = { users: 4, communities: 4, ads: 5, categories: 5 };

/** Debounced multi-source search (people/communities/ads/categories) shared
 *  by the desktop dropdown (GlobalSearch) and the mobile full-screen
 *  overlay (MobileSearchOverlay). `perPage` caps every source uniformly;
 *  omitting it keeps the original desktop-dropdown limits. */
export function useGlobalSearch(
  query: string,
  opts?: { perPage?: number },
): { results: SearchResults; loading: boolean } {
  const [results, setResults] = useState<SearchResults>(EMPTY);
  const [loading, setLoading] = useState(false);
  const requestId = useRef(0);
  const q = query.trim();
  const perPage = opts?.perPage;

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
        fetchListings({ q, perPage: perPage ?? DEFAULT_PER_PAGE.ads }).catch(() => []),
        fetchListingCategories().catch(() => []),
      ]).then(([users, communities, ads, allCategories]) => {
        if (id !== requestId.current) return;
        const qLower = q.toLowerCase();
        const categories = allCategories
          .filter((c) => c.name.toLowerCase().includes(qLower))
          .slice(0, perPage ?? DEFAULT_PER_PAGE.categories);
        setResults({
          users: users.slice(0, perPage ?? DEFAULT_PER_PAGE.users),
          communities: communities.slice(0, perPage ?? DEFAULT_PER_PAGE.communities),
          ads: ads.slice(0, perPage ?? DEFAULT_PER_PAGE.ads),
          categories,
        });
        setLoading(false);
      });
    }, DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [q, perPage]);

  return { results, loading };
}
