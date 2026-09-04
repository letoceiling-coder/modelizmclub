import { splitByQuery } from "@/lib/message-search";

export function HighlightedText({
  text,
  query,
  matchClassName = "rounded-[3px] bg-[#ffe066] px-[1px] text-[inherit]",
}: {
  text: string;
  query: string;
  matchClassName?: string;
}) {
  const parts = splitByQuery(text, query);
  return (
    <>
      {parts.map((part, i) =>
        part.match ? (
          <mark
            key={i}
            className={matchClassName}
            style={{ background: "var(--accent-soft)", color: "inherit" }}
          >
            {part.text}
          </mark>
        ) : (
          <span key={i}>{part.text}</span>
        ),
      )}
    </>
  );
}
