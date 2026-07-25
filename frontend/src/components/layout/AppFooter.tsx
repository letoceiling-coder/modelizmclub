import { Link } from "@tanstack/react-router";
import { FooterContactsBlock } from "@/components/layout/FooterContactsBlock";
import { SUPPORT_LINKS, COMPANY_LINKS, DOCS_LINKS } from "@/lib/footer-links";
import { useFooterContacts } from "@/lib/hooks/useFooterContacts";

const COLUMNS: { title: string; links: typeof SUPPORT_LINKS }[] = [
  { title: "Поддержка", links: SUPPORT_LINKS },
  { title: "Компания", links: COMPANY_LINKS },
  { title: "Документы", links: DOCS_LINKS },
];

export function AppFooter() {
  const contacts = useFooterContacts();

  return (
    <footer
      className="mt-[32px] w-full"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="grid gap-[24px] py-[24px] sm:grid-cols-2 lg:grid-cols-4">
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
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neutral-700)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-50)")}
                  >
                    {l.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        ))}

        <FooterContactsBlock
          contacts={contacts}
          listClassName="mt-[10px] flex flex-col gap-[8px] text-[13px]"
          titleClassName="text-[13px] font-semibold"
        />
      </div>

      <div className="pb-[24px] text-[11px]" style={{ color: "var(--foreground-30)" }}>
        © {new Date().getFullYear()} МоДелизМ
      </div>
    </footer>
  );
}
