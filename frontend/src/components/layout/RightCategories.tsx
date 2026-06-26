import { useEffect, useState } from "react";
import type { Category } from "@/lib/types";
import { fetchListingCategories } from "@/lib/api/catalog";
import { Link } from "@tanstack/react-router";

export function RightCategories() {
  const [categories, setCategories] = useState<Category[]>([]);

  useEffect(() => {
    void fetchListingCategories().then(setCategories);
  }, []);

  if (categories.length === 0) return null;

  return (
    <aside className="space-y-2">
      <h3 className="text-[13px] font-semibold uppercase tracking-wide" style={{ color: "var(--foreground-50)" }}>Категории</h3>
      <ul className="space-y-1">
        {categories.slice(0, 8).map((c) => (
          <li key={c.id}>
            <Link to="/categories/$id" params={{ id: c.slug ?? c.id }} className="block rounded-lg px-3 py-2 text-[13px] hover:bg-[var(--background-surface)]" style={{ color: "var(--foreground-70)" }}>
              {c.name}
            </Link>
          </li>
        ))}
      </ul>
    </aside>
  );
}
