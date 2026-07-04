import * as Icons from "lucide-react";
import { useListingCategories } from "@/lib/hooks/useCategories";
import type { Category } from "@/lib/mock";

function CategoryIcon({ name }: { name: string }) {
  const Icon =
    (Icons as unknown as Record<string, React.ComponentType<{ size?: number; className?: string }>>)[name] ??
    Icons.Tag;
  return <Icon size={15} />;
}

interface CategoryChipsProps {
  value: string;
  onChange: (name: string) => void;
}

export function CategoryChips({ value, onChange }: CategoryChipsProps) {
  const categories = useListingCategories();

  const all = [
    { id: "all", name: "Все", icon: "LayoutGrid" } as Pick<Category, "id" | "name" | "icon">,
    ...categories.map((c) => ({ id: c.id, name: c.name, icon: c.icon })),
  ];

  return (
    <div
      className="flex gap-[8px] overflow-x-auto pb-[4px]"
      style={{ scrollbarWidth: "none" }}
    >
      {all.map((cat) => {
        const active = value === cat.name;
        return (
          <button
            key={cat.id}
            type="button"
            onClick={() => onChange(cat.name)}
            className="inline-flex shrink-0 items-center gap-[6px] whitespace-nowrap text-[12.5px] font-medium transition-all"
            style={{
              height: 34,
              padding: "0 12px",
              borderRadius: "var(--r-pill)",
              background: active ? "var(--accent)" : "var(--background-elevated)",
              color: active ? "var(--accent-foreground)" : "var(--foreground-70)",
              border: `1px solid ${active ? "var(--accent)" : "var(--border)"}`,
              boxShadow: active ? "0 1px 6px color-mix(in oklab,var(--accent) 25%,transparent)" : "none",
            }}
          >
            <CategoryIcon name={cat.icon} />
            {cat.name}
          </button>
        );
      })}
    </div>
  );
}
