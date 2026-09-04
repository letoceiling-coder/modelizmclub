import { useCallback, useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { useTranslation } from "react-i18next";

const MAX_TAGS = 10;
const MAX_TAG_LEN = 64;

function normalizeTag(raw: string): string {
  return raw.trim().replace(/^#+/, "").slice(0, MAX_TAG_LEN);
}

interface Props {
  tags: string[];
  onChange: (tags: string[]) => void;
  suggestions?: string[];
  disabled?: boolean;
}

export function TagInput({ tags, onChange, suggestions = [], disabled }: Props) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState("");

  const addTag = useCallback(
    (raw: string) => {
      const tag = normalizeTag(raw);
      if (!tag || tags.length >= MAX_TAGS) return;
      const key = tag.toLowerCase();
      if (tags.some((x) => x.toLowerCase() === key)) return;
      onChange([...tags, tag]);
      setDraft("");
    },
    [tags, onChange],
  );

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      addTag(draft);
    } else if (e.key === "Backspace" && !draft && tags.length > 0) {
      onChange(tags.slice(0, -1));
    }
  };

  const filteredSuggestions = suggestions
    .filter((s) => {
      const q = draft.trim().toLowerCase();
      if (!q) return false;
      return s.toLowerCase().includes(q) && !tags.some((t) => t.toLowerCase() === s.toLowerCase());
    })
    .slice(0, 8);

  return (
    <div className="space-y-[8px]">
      <div
        className="flex min-h-[44px] flex-wrap items-center gap-[6px] rounded-[var(--r-input)] border px-[10px] py-[8px]"
        style={{ borderColor: "var(--border)", background: "var(--background-elevated)" }}
      >
        {tags.map((tag) => (
          <span
            key={tag}
            className="inline-flex items-center gap-[4px] rounded-full px-[10px] py-[4px] text-[12px] font-medium"
            style={{
              background: "var(--background-surface)",
              color: "var(--foreground-70)",
              border: "1px solid var(--border)",
            }}
          >
            #{tag}
            {!disabled && (
              <button
                type="button"
                aria-label={t("components.tagInput.remove", { tag })}
                onClick={() => onChange(tags.filter((x) => x !== tag))}
                className="grid h-[18px] w-[18px] place-items-center rounded-full hover:bg-[var(--accent-soft)]"
              >
                <X size={12} />
              </button>
            )}
          </span>
        ))}
        {!disabled && tags.length < MAX_TAGS && (
          <input
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            onBlur={() => {
              if (draft.trim()) addTag(draft);
            }}
            placeholder={tags.length === 0 ? t("components.tagInput.placeholder") : ""}
            className="min-w-[120px] flex-1 bg-transparent text-[14px] outline-none"
            style={{ color: "var(--foreground)" }}
          />
        )}
      </div>
      <div className="text-[11px]" style={{ color: "var(--foreground-50)" }}>
        {t("components.tagInput.hint", { count: tags.length, max: MAX_TAGS })}
      </div>
      {filteredSuggestions.length > 0 && (
        <div className="flex flex-wrap gap-[6px]">
          {filteredSuggestions.map((s) => (
            <button
              key={s}
              type="button"
              onClick={() => addTag(s)}
              className="rounded-full px-[10px] py-[4px] text-[12px] font-medium transition-colors hover:bg-[var(--accent-soft)]"
              style={{ color: "var(--accent)", border: "1px solid var(--border)" }}
            >
              #{s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
