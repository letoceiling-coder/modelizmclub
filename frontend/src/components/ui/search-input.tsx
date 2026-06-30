import * as React from "react";
import { Search, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Input, type InputProps } from "@/components/ui/input";

export interface SearchInputProps extends Omit<InputProps, "type"> {
  /** Shows a clear (×) button when there is a value; calls onClear on click. */
  onClear?: () => void;
}

const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  ({ className, value, onClear, ...props }, ref) => {
    return (
      <div className="relative w-full">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-[var(--neutral-400)]"
        />
        <Input
          ref={ref}
          type="search"
          value={value}
          className={cn("pl-9", onClear && value ? "pr-9" : "", className)}
          {...props}
        />
        {onClear && value ? (
          <button
            type="button"
            onClick={onClear}
            aria-label="Очистить"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-[var(--neutral-400)] transition-colors hover:text-[var(--foreground)]"
          >
            <X className="size-4" />
          </button>
        ) : null}
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
