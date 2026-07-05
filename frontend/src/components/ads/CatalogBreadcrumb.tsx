import { ChevronRight } from "lucide-react";

interface Props {
  category: string;
  subcategory: string;
  onResetToRoot: () => void;
  onResetToCategory: () => void;
}

export function CatalogBreadcrumb({ category, subcategory, onResetToRoot, onResetToCategory }: Props) {
  const hasCategory = category !== "Все";
  const hasSubcategory = hasCategory && subcategory !== "Все";

  const sep = (
    <ChevronRight size={13} className="shrink-0" style={{ color: "var(--foreground-30)" }} />
  );

  return (
    <nav className="flex items-center gap-[6px] text-[12px]" aria-label="Хлебные крошки">
      {/* root */}
      {hasCategory ? (
        <button
          type="button"
          onClick={onResetToRoot}
          className="transition-colors hover:underline"
          style={{ color: "var(--foreground-50)" }}
        >
          Каталог
        </button>
      ) : (
        <span style={{ color: "var(--foreground-50)" }}>Каталог</span>
      )}

      {/* category level */}
      {hasCategory && (
        <>
          {sep}
          {hasSubcategory ? (
            <button
              type="button"
              onClick={onResetToCategory}
              className="transition-colors hover:underline"
              style={{ color: "var(--foreground-50)" }}
            >
              {category}
            </button>
          ) : (
            <span className="font-medium" style={{ color: "var(--foreground-70)" }}>{category}</span>
          )}
        </>
      )}

      {/* subcategory level */}
      {hasSubcategory && (
        <>
          {sep}
          <span className="font-medium" style={{ color: "var(--foreground-70)" }}>{subcategory}</span>
        </>
      )}
    </nav>
  );
}
