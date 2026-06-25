import { Link } from "@tanstack/react-router";
import { ChevronRight, Home } from "lucide-react";
import type { ReactNode } from "react";

export interface Crumb {
  label: ReactNode;
  to?: string;
  params?: Record<string, string>;
}

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav
      aria-label="Хлебные крошки"
      className="flex items-center gap-1 overflow-x-auto whitespace-nowrap text-[12.5px]"
      style={{ color: "var(--foreground-50)" }}
    >
      <Link
        to="/feed"
        className="inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 hover:bg-[var(--background-surface)]"
      >
        <Home className="h-3.5 w-3.5" />
        <span className="sr-only">Главная</span>
      </Link>
      {items.map((item, i) => {
        const last = i === items.length - 1;
        return (
          <span key={i} className="inline-flex items-center gap-1">
            <ChevronRight className="h-3.5 w-3.5 opacity-60" />
            {item.to && !last ? (
              <Link
                to={item.to as never}
                params={item.params as never}
                className="rounded-md px-1.5 py-0.5 hover:bg-[var(--background-surface)] hover:text-[var(--foreground-70)]"
              >
                {item.label}
              </Link>
            ) : (
              <span
                aria-current={last ? "page" : undefined}
                className="rounded-md px-1.5 py-0.5"
                style={last ? { color: "var(--foreground)", fontWeight: 600 } : undefined}
              >
                {item.label}
              </span>
            )}
          </span>
        );
      })}
    </nav>
  );
}
