import { итогПриглашения } from "@/lib/referral";

/**
 * Значок у приглашённого: что это приглашение принесло.
 *
 * Значок один на страницу приглашений и на блок приглашённых — разметка у
 * них совпадала до пикселя, а слова расходились: «Ожидает подтверждения
 * телефона» против «Ждёт телефон». Разошлись бы и дальше.
 *
 * Зелёным — только когда начислено на самом деле. Закрытое приглашение без
 * баллов (исчерпан предел, повторный телефон) зелёным быть не должно:
 * цвет читается раньше слов.
 */
export function ИтогПриглашения({
  inv,
}: {
  inv: { status: string; points?: number | null; listingCredits?: number | null };
}) {
  const { подпись, начислено } = итогПриглашения(inv);

  return (
    <span
      className="shrink-0 font-semibold"
      style={{
        fontSize: 12,
        padding: "4px 10px",
        borderRadius: "var(--r-pill)",
        color: начислено ? "var(--success)" : "var(--foreground-70)",
        background: начислено ? "var(--success-soft)" : "var(--background-surface)",
      }}
    >
      {подпись}
    </span>
  );
}
