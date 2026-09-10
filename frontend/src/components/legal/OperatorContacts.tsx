import { useTranslation } from "react-i18next";
import { useFooterContacts } from "@/lib/hooks/useFooterContacts";
import { phoneTelHref } from "@/lib/footer-contacts";

/**
 * Реквизиты и контакты оператора на странице «Контакты».
 *
 * Страница до 10.09 состояла из одной фразы «свяжитесь через форму обратной
 * связи или контакты в подвале»: то есть отсылала за реквизитами в другое
 * место, а телефон и режим работы не публиковались нигде. Статья 9 ЗоЗПП
 * требует наименование, место нахождения и режим работы; статья 10 — чтобы
 * это было доступно, а не лежало у кого-то в документе.
 *
 * Значения берутся из той же настройки `footer.contacts`, что и подвал, —
 * второго источника заводить нельзя: разойдутся, и потом не выяснить, какой
 * из двух правильный. Правятся из админки, выкатки не требуют.
 *
 * Строка, у которой значение пустое, не рисуется вовсе. Пустая строка
 * «Телефон: —» хуже отсутствия: она утверждает, что телефона нет.
 */
export function OperatorContacts() {
  const { t } = useTranslation();
  const contacts = useFooterContacts();

  if (!contacts) return null;

  const rows: { label: string; value: React.ReactNode }[] = [];

  const push = (label: string, value?: string, render?: (v: string) => React.ReactNode) => {
    if (!value) return;
    rows.push({ label, value: render ? render(value) : value });
  };

  push(t("pages.legal.contactsLegalName"), contacts.legal_name);
  push(t("pages.legal.contactsInn"), contacts.inn);
  push(t("pages.legal.contactsOgrn"), contacts.ogrn);
  push(t("pages.legal.contactsAddress"), contacts.address);
  push(t("pages.legal.contactsEmail"), contacts.email, (v) => (
    <a href={`mailto:${v}`} style={{ color: "var(--accent)" }}>
      {v}
    </a>
  ));
  push(t("pages.legal.contactsPhone"), contacts.phone, (v) => (
    <a href={phoneTelHref(v)} style={{ color: "var(--accent)" }}>
      {v}
    </a>
  ));
  push(t("pages.legal.contactsHours"), contacts.hours);

  if (rows.length === 0) return null;

  return (
    <div className="mt-10 rounded-xl border p-5" style={{ borderColor: "var(--border)" }}>
      <h2 className="mb-3 text-lg font-semibold">{t("pages.legal.contactsRequisitesTitle")}</h2>
      <dl className="grid gap-x-4 gap-y-2 sm:grid-cols-[minmax(0,160px)_1fr]">
        {rows.map((row) => (
          <div key={row.label} className="contents">
            <dt className="text-[14px]" style={{ color: "var(--foreground-50)" }}>
              {row.label}
            </dt>
            <dd className="text-[15px]" style={{ color: "var(--foreground)" }}>
              {row.value}
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
