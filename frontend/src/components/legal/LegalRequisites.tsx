/** Реквизиты оператора ПДн — отображаются в футере на всех страницах. */
export function LegalRequisites() {
  return (
    <div className="mt-4 space-y-1 text-[11px] leading-relaxed" style={{ color: "var(--foreground-30)" }}>
      <div>
        ООО «МОДЕЛИЗМ», ИНН 2312341754, ОГРН 1262300020751
      </div>
      <div>350000 г. Краснодар, ул. Симферопольская 56-112</div>
      <div>
        <a href="mailto:modelizmclub@mail.ru" className="underline hover:opacity-80">
          modelizmclub@mail.ru
        </a>
      </div>
      {/* Реестровый номер РКН — скрыто до получения */}
    </div>
  );
}
