import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FooterContactsBlock } from "@/components/layout/FooterContactsBlock";
import { FOOTER_COLUMNS } from "@/lib/footer-links";
import { useFooterContacts } from "@/lib/hooks/useFooterContacts";

export function AppFooter() {
  const { t } = useTranslation();
  const contacts = useFooterContacts();

  return (
    <footer
      className="mt-[32px] w-full"
      style={{ borderTop: "1px solid var(--border)" }}
    >
      <div className="grid gap-[24px] py-[24px] sm:grid-cols-2 lg:grid-cols-4">
        {FOOTER_COLUMNS.map((col) => (
          <div key={col.titleKey}>
            <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
              {t(col.titleKey)}
            </div>
            <ul className="mt-[10px] flex flex-col gap-[8px]">
              {col.links.map((l) => (
                <li key={l.labelKey}>
                  <Link
                    to={l.to}
                    className="text-[13px] transition-colors"
                    style={{ color: "var(--foreground-50)" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "var(--neutral-700)")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "var(--foreground-50)")}
                  >
                    {t(l.labelKey)}
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
        © {new Date().getFullYear()} {t("common.appName")}
      </div>
    </footer>
  );
}
