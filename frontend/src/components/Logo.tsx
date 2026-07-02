import wordmark from "@/assets/logo-modelizm-wordmark.png";

export function Logo({ size = 32, showText = false }: { size?: number; showText?: boolean }) {
  // The wordmark artwork is dark — it reads well on light surfaces but
  // disappears on dark backgrounds. We wrap it in a subtle light "plate"
  // (visible only in dark mode via the .dark scope) so it always pops.
  // `showText` (the "Форум" sub-label) is off by default — the wordmark alone
  // is the brand; the extra word cluttered the hero/header.
  const height = size;
  return (
    <div className="flex min-w-0 items-center gap-2">
      <span className="logo-plate inline-flex min-w-0 items-center justify-center">
        <img
          src={wordmark}
          alt="МоДелизМ"
          height={height}
          className="object-contain block"
          // maxWidth:100% lets the wordmark shrink to fit its container instead
          // of pushing sibling controls (theme/language) out of the header row.
          style={{ height, width: "auto", maxWidth: "100%" }}
        />
      </span>
      {showText && (
        <span
          className="font-display text-[10px] font-bold uppercase tracking-[0.18em]"
          style={{ color: "var(--accent)" }}
        >
          Форум
        </span>
      )}
    </div>
  );
}
