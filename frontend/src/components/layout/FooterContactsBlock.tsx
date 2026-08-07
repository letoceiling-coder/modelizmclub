import { hasFooterContacts, phoneTelHref, type FooterContacts } from "@/lib/footer-contacts";
import { useTranslation } from "react-i18next";

interface Props {
  contacts: FooterContacts | null | undefined;
  title?: string;
  className?: string;
  listClassName?: string;
  titleClassName?: string;
}

export function FooterContactsBlock({
  contacts,
  title,
  className,
  listClassName = "mt-4 flex flex-col gap-2.5 text-sm",
  titleClassName = "text-sm font-semibold",
}: Props) {
  const { t } = useTranslation();
  if (!hasFooterContacts(contacts)) return null;

  return (
    <div className={className}>
      <div className={titleClassName} style={{ color: "var(--foreground)" }}>
        {title ?? t("landing.footer.contacts")}
      </div>
      <ul className={listClassName} style={{ color: "var(--foreground-50)" }}>
        {contacts?.email && (
          <li>
            <a href={`mailto:${contacts.email}`} style={{ color: "inherit" }}>
              {contacts.email}
            </a>
          </li>
        )}
        {contacts?.phone && (
          <li>
            <a href={phoneTelHref(contacts.phone)} style={{ color: "inherit" }}>
              {contacts.phone}
            </a>
          </li>
        )}
        {contacts?.hours && <li>{contacts.hours}</li>}
      </ul>
      {(contacts?.social?.length ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {contacts!.social!.map((s) => (
            <a
              key={s.label}
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center rounded-[var(--r-pill)] px-[10px] py-[4px] text-[11px] font-semibold transition-opacity hover:opacity-80"
              style={{
                background: "var(--background-surface)",
                color: "var(--foreground-70)",
                border: "1px solid var(--border)",
              }}
            >
              {s.label}
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
