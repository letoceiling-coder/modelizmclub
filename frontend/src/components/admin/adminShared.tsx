import type { ReactNode, CSSProperties } from "react";

export type AdminRole = "admin" | "moderator";

/** Section heading used across every admin panel section. */
export function H({ children, action }: { children: ReactNode; action?: ReactNode }) {
  return (
    <div
      className="flex items-center justify-between flex-wrap gap-[12px]"
      style={{ marginBottom: "16px" }}
    >
      <h2
        style={{
          fontFamily: "var(--font-display)",
          fontWeight: 700,
          fontSize: "var(--fs-h4)",
          color: "var(--foreground)",
        }}
      >
        {children}
      </h2>
      {action}
    </div>
  );
}

export const card = {
  background: "var(--background-elevated)",
  border: "1px solid var(--border)",
  borderRadius: "var(--r-card)",
};
export const inputStyle: CSSProperties = {
  height: "40px",
  background: "var(--background-elevated)",
  border: "1.5px solid var(--border)",
  borderRadius: "var(--r-input)",
  padding: "0 14px",
  fontSize: "13px",
  color: "var(--foreground)",
};
export const primaryBtn: CSSProperties = {
  background: "var(--accent)",
  color: "var(--accent-foreground)",
  fontWeight: 600,
  fontSize: "13px",
  borderRadius: "var(--r-button)",
  padding: "0 16px",
  height: "40px",
};

export function IconBtn({
  children,
  onClick,
  danger,
  success,
  title,
}: {
  children: ReactNode;
  onClick: () => void;
  danger?: boolean;
  success?: boolean;
  title?: string;
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        width: "32px",
        height: "32px",
        borderRadius: "var(--r-card-sm)",
        border: "1px solid var(--border)",
        background: "transparent",
        color: danger ? "var(--error)" : success ? "var(--success)" : "var(--foreground-70)",
        display: "grid",
        placeItems: "center",
        transition: "background 150ms ease",
      }}
      onMouseEnter={(e) =>
        (e.currentTarget.style.background = danger
          ? "var(--error-soft)"
          : success
            ? "var(--success-soft)"
            : "var(--background-surface)")
      }
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {children}
    </button>
  );
}

/** Titled section container used by the design-system sandbox (theme
 *  controls panel + component preview showcase). */
export function Panel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section
      style={{
        background: "var(--background-elevated)",
        border: "1px solid var(--border)",
        borderRadius: "var(--r-card)",
        padding: 16,
      }}
    >
      <h3
        style={{
          fontSize: 13,
          fontWeight: 600,
          color: "var(--foreground-70)",
          marginBottom: 12,
          textTransform: "uppercase",
          letterSpacing: 0.5,
        }}
      >
        {title}
      </h3>
      {children}
    </section>
  );
}

export type BadgeVariant = "published" | "moderation" | "rejected" | "default";

export function statusMeta(
  map: Record<string, { label: string; variant: BadgeVariant }>,
  status: string,
) {
  return map[status] ?? { label: status || "—", variant: "default" as BadgeVariant };
}
