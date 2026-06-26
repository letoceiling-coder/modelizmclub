import wordmark from "@/assets/logo-modelizm-wordmark.png";

export function Logo({ size = 32, showText = true }: { size?: number; showText?: boolean }) {
  // The new wordmark already contains "МоДелизМ" lettering with the plane swoosh.
  // We render it as a single horizontal image. `size` controls the height.
  const height = size;
  return (
    <div className="flex items-center gap-2">
      <img
        src={wordmark}
        alt="МоДелизМ Форум"
        height={height}
        className="object-contain"
        style={{ height, width: "auto", maxWidth: showText ? height * 5 : height * 1.2 }}
      />
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
