/** Semi-transparent "Забронировано" veil over a listing photo (Avito-style).
 *  The listing stays in the catalog, it just can't be bought right now. */
export function ReservedOverlay({ compact }: { compact?: boolean }) {
  return (
    <div
      className="pointer-events-none absolute inset-0 grid place-items-center"
      style={{ background: "color-mix(in oklab, var(--background) 55%, transparent)" }}
    >
      <span
        className="font-display font-semibold uppercase tracking-wide"
        style={{
          fontSize: compact ? 11 : 13,
          padding: compact ? "4px 10px" : "6px 14px",
          borderRadius: "var(--r-pill)",
          background: "color-mix(in oklab, var(--foreground) 82%, transparent)",
          color: "var(--background)",
        }}
      >
        Забронировано
      </span>
    </div>
  );
}
