import wordmark from "@/assets/logo-modelizm-wordmark.png";

/** Full-viewport preload until bootstrap, session and the route loader finish. */
export function AppBootPreload() {
  return (
    <div
      className="grid min-h-[100dvh] place-items-center"
      style={{ background: "var(--background)", color: "var(--foreground)" }}
      role="status"
      aria-live="polite"
      aria-busy="true"
    >
      <div className="flex flex-col items-center gap-5 px-6">
        <img
          src={wordmark}
          width={1600}
          height={514}
          loading="lazy"
          decoding="async"
          alt="МоДелизМ"
          className="block object-contain"
          style={{ height: 40, width: "auto", maxWidth: 220 }}
        />
        <div
          className="h-8 w-8 animate-spin rounded-full"
          style={{
            border: "2px solid var(--border)",
            borderTopColor: "var(--accent)",
          }}
          aria-hidden
        />
        <p className="text-sm" style={{ color: "var(--foreground-50)" }}>
          Загрузка…
        </p>
      </div>
    </div>
  );
}
