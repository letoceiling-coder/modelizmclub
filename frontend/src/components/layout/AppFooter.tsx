import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { FooterContactsBlock } from "@/components/layout/FooterContactsBlock";
import { LegalRequisites } from "@/components/legal/LegalRequisites";
import { FOOTER_COLUMNS } from "@/lib/footer-links";
import { footerLinkLabel, groupTitle, resolveFooterHref, useFooterLinksApi } from "@/lib/hooks/useFooterLinks";
import { useFooterContacts } from "@/lib/hooks/useFooterContacts";

export function AppFooter() {
  const { t } = useTranslation();
  const contacts = useFooterContacts();
  const { data: apiGroups } = useFooterLinksApi();

  const apiEntries = apiGroups ? Object.entries(apiGroups).filter(([, links]) => links.length > 0) : null;

  return (
    <footer className="mt-[32px] w-full" style={{ borderTop: "1px solid var(--border)" }}>
      <div className="grid gap-[24px] py-[24px] sm:grid-cols-2 lg:grid-cols-4">
        {apiEntries && apiEntries.length > 0
          ? apiEntries.map(([group, links]) => (
              <div key={group}>
                <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {groupTitle(group, t)}
                </div>
                <ul className="mt-[10px] flex flex-col gap-[8px]">
                  {links.map((l) => {
                    const href = resolveFooterHref(l);
                    const label = footerLinkLabel(l.label, t);
                    return (
                      <li key={`${group}-${l.id}`}>
                        {l.target_type === "external" ? (
                          <a
                            href={href}
                            className="text-[13px] transition-colors"
                            style={{ color: "var(--foreground-50)" }}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            {label}
                          </a>
                        ) : (
                          <Link
                            to={href}
                            className="text-[13px] transition-colors"
                            style={{ color: "var(--foreground-50)" }}
                          >
                            {label}
                          </Link>
                        )}
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))
          : FOOTER_COLUMNS.map((col) => (
              <div key={col.titleKey}>
                <div className="text-[13px] font-semibold" style={{ color: "var(--foreground)" }}>
                  {t(col.titleKey)}
                </div>
                <ul className="mt-[10px] flex flex-col gap-[8px]">
                  {col.links.map((l) => (
                    <li key={l.labelKey}>
                      <Link to={l.to} className="text-[13px]" style={{ color: "var(--foreground-50)" }}>
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

      <LegalRequisites />

      <div className="pb-[24px] pt-2 text-[11px]" style={{ color: "var(--foreground-30)" }}>
        © {new Date().getFullYear()} {t("common.appName")}
      </div>
    </footer>
  );
}
