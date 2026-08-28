import { useEffect, useState } from "react";
import type { Category } from "@/lib/mock";
import {
  fetchPostCategories,
  fetchListingCategories,
  getCachedPostCategories,
  getCachedListingCategories,
} from "@/lib/api/categories";

export function usePostCategoriesState(): { categories: Category[]; loading: boolean } {
  const [categories, setCategories] = useState<Category[]>(() => getCachedPostCategories() ?? []);
  const [loading, setLoading] = useState(() => !getCachedPostCategories());

  useEffect(() => {
    if (getCachedPostCategories()) return;
    let active = true;
    fetchPostCategories()
      .then((c) => { if (active) setCategories(c); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { categories, loading };
}

export function useListingCategoriesState(): { categories: Category[]; loading: boolean } {
  const [categories, setCategories] = useState<Category[]>(() => getCachedListingCategories() ?? []);
  const [loading, setLoading] = useState(() => !getCachedListingCategories());

  useEffect(() => {
    if (getCachedListingCategories()) return;
    let active = true;
    fetchListingCategories()
      .then((c) => { if (active) setCategories(c); })
      .catch(() => {})
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  return { categories, loading };
}

export function usePostCategories(): Category[] {
  return usePostCategoriesState().categories;
}

export function useListingCategories(): Category[] {
  return useListingCategoriesState().categories;
}
