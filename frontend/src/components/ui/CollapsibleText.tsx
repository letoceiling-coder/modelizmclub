import { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";

interface Props {
  text: string;
  /** Approximate max lines before collapse. */
  maxLines?: number;
  className?: string;
  style?: React.CSSProperties;
}

export function CollapsibleText({ text, maxLines = 6, className, style }: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const [overflows, setOverflows] = useState(false);
  const ref = useRef<HTMLParagraphElement>(null);

  useEffect(() => {
    setExpanded(false);
  }, [text]);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const check = () => {
      if (expanded) return;
      setOverflows(el.scrollHeight > el.clientHeight + 2);
    };
    check();
    const ro = typeof ResizeObserver !== "undefined" ? new ResizeObserver(check) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [text, expanded, maxLines]);

  if (!text.trim()) return null;

  return (
    <div className={className}>
      <p
        ref={ref}
        className="whitespace-pre-line text-[14px] leading-[1.6] transition-[max-height] duration-300 ease-out"
        style={{
          color: "var(--foreground-90)",
          overflow: expanded ? "visible" : "hidden",
          display: expanded ? "block" : "-webkit-box",
          WebkitLineClamp: expanded ? undefined : maxLines,
          WebkitBoxOrient: expanded ? undefined : "vertical",
          ...style,
        }}
      >
        {text}
      </p>
      {(overflows || expanded) && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          className="mt-[8px] text-[13px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--accent)" }}
        >
          {expanded
            ? t("components.collapsibleText.collapse")
            : t("components.collapsibleText.expand")}
        </button>
      )}
    </div>
  );
}
