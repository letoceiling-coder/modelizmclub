import { Link } from "@tanstack/react-router";
import { SUPPORT_LINKS, COMPANY_LINKS, DOCS_LINKS, SOCIAL_LINKS } from "@/lib/footer-links";

const COLUMNS: { title: string; links: typeof SUPPORT_LINKS }[] = [
  { title: "Поддержка", links: SUPPORT_LINKS },
  { title: "Компания", links: COMPANY_LINKS },
  { title: "Документы", links: DOCS_LINKS },
];

export function AppFooter() {
  return (
    <footer
      className="mt-[32px] w-full"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="grid gap-[24px] py-[24px] sm:grid-cols-3">
        {COLUMNS.map((col) => (
          <div key={col.title}>
            <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
              {col.title}
            </div>
            <ul className="mt-[10px] flex flex-col gap-[8px]">
              {col.links.map((l) => (
                <li key={l.label}>
                  <Link
                    to={l.to}
                    className="text-[13px] transition-colors"
                    style={{ color: "var(--foreground-50)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--accent)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-50)")}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-[10px] pb-[16px]">
        {SOCIAL_LINKS.map((s) => (
          <span
            key={s.label}
            title="Скоро"
            className="inline-flex items-center rounded-[var(--r-pill)] px-[10px] py-[4px] text-[11px] font-semibold"
            style={{
              background: "var(--background-surface)",
              color: "var(--foreground-50)",
              border: "1px solid var(--border)",
            }}
          >
            {s.label}
          </span>
        ))}
      </div>

      <div className="pb-[24px] text-[11px]" style={{ color: "var(--foreground-30)" }}>
        © {new Date().getFullYear()} МоДелизМ
      </div>
    </footer>
  );
}
