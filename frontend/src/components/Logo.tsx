import wordmark from "@/assets/logo-modelizm-wordmark.png";

export function Logo({ size = 32, showText = true }: { size?: number; showText?: boolean }) {
  // The wordmark artwork is dark — it reads well on light surfaces but
  // disappears on dark backgrounds. We wrap it in a subtle light "plate"
  // (visible only in dark mode via the .dark scope) so it always pops.
  const height = size;
  return (
    <div className="flex items-center gap-2">
      <span className="logo-plate inline-flex items-center justify-center">
        <img
          src={wordmark}
          alt="МоДелизМ Форум"
          height={height}
          className="object-contain block"
          style={{ height, width: "auto", maxWidth: showText ? height * 5 : height * 1.2 }}
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
