import { useEffect, useState } from "react";
import type { Category } from "@/lib/mock";
import { fetchPostCategories, fetchListingCategories } from "@/lib/api/categories";

export function usePostCategories(): Category[] {
  const [cats, setCats] = useState<Category[]>([]);
  useEffect(() => {
    let active = true;
    fetchPostCategories()
      .then((c) => { if (active) setCats(c); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return cats;
}

export function useListingCategories(): Category[] {
  const [cats, setCats] = useState<Category[]>([]);
  useEffect(() => {
    let active = true;
    fetchListingCategories()
      .then((c) => { if (active) setCats(c); })
      .catch(() => {});
    return () => { active = false; };
  }, []);
  return cats;
}
