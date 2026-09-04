import { useFooterContacts } from "@/lib/hooks/useFooterContacts";

/** Реквизиты оператора ПДн — из настроек админки (footer.contacts). */
export function LegalRequisites() {
  const contacts = useFooterContacts();
  const line1 = [
    contacts?.legal_name,
    contacts?.inn ? `ИНН ${contacts.inn}` : null,
    contacts?.ogrn ? `ОГРН ${contacts.ogrn}` : null,
  ]
    .filter(Boolean)
    .join(", ");
  const email = contacts?.email;

  if (!line1 && !contacts?.address && !email) return null;

  return (
    <div
      className="mt-4 space-y-1 text-[11px] leading-relaxed"
      style={{ color: "var(--foreground-30)" }}
    >
      {line1 ? <div>{line1}</div> : null}
      {contacts?.address ? <div>{contacts.address}</div> : null}
      {email ? (
        <div>
          <a href={`mailto:${email}`} className="underline hover:opacity-80">
            {email}
          </a>
        </div>
      ) : null}
    </div>
  );
}
