import { Gift } from "lucide-react";
import { Card } from "@/components/ui/card";
import { useBonusPoints } from "@/lib/api/bonus-points";
import { словоБаллы } from "@/lib/format/plural";
import { formatDate } from "@/lib/format/date";

/**
 * Счёт баллов в кошельке — отдельной карточкой, а не строкой баланса.
 *
 * Баллы не рубли: их нельзя вывести и нельзя пополнить деньгами. Поставить
 * их рядом с рублёвым остатком одной цифрой значило бы напроситься на
 * вопрос «почему не выводится». Поэтому своя карточка, своя история и
 * сказано прямо.
 *
 * История показывает, за что списались: подпись проводки приходит с
 * сервера («Размещение объявления: Авиация»), а не собирается здесь из
 * типа — иначе назначение пришлось бы угадывать по коду.
 */
export function BonusPointsCard() {
  const { data, loading } = useBonusPoints();

  // Пока не знаем — не показываем: пустая карточка «0 баллов» читается как
  // ответ сервера, а это ещё не ответ.
  if (loading || !data) return null;
  if (!data.enabled && data.balance === 0 && data.history.length === 0) return null;

  return (
    <Card className="mt-[16px] p-[16px]">
      <div className="flex items-start gap-[12px]">
        <span
          className="grid h-[40px] w-[40px] shrink-0 place-items-center rounded-full"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          <Gift size={18} />
        </span>
        <div className="min-w-0 flex-1">
          <div className="text-[14px] font-semibold" style={{ color: "var(--foreground)" }}>
            Бонусные баллы
          </div>
          <div className="text-[22px] font-bold" style={{ color: "var(--foreground)" }}>
            {data.balance.toLocaleString("ru-RU")} {словоБаллы(data.balance)}
          </div>
          <p className="mt-[4px] text-[12px]" style={{ color: "var(--foreground-50)" }}>
            Баллы не выводятся деньгами.{" "}
            {data.enabled && data.listing_placement_points > 0
              ? `Ими можно оплатить размещение объявления — ${data.listing_placement_points} ${словоБаллы(data.listing_placement_points)}.`
              : "Оплата баллами сейчас недоступна."}
          </p>
        </div>
      </div>

      {data.enabled && data.boosts.some((b) => b.points > 0) && (
        <div className="mt-[12px] flex flex-wrap gap-[8px]">
          {data.boosts
            .filter((b) => b.points > 0)
            .map((b) => (
              <span
                key={b.id}
                className="rounded-[var(--r-pill)] px-[10px] py-[4px] text-[12px]"
                style={{ background: "var(--background-surface)", color: "var(--foreground-70)" }}
              >
                {b.label} — {b.points} {словоБаллы(b.points)}
              </span>
            ))}
        </div>
      )}

      {data.history.length > 0 && (
        <ul className="mt-[14px] space-y-[8px]">
          {data.history.map((row) => (
            <li key={row.id} className="flex items-start justify-between gap-[12px]">
              <div className="min-w-0">
                <div className="text-[13px]" style={{ color: "var(--foreground)" }}>
                  {row.description || "Операция с баллами"}
                </div>
                {row.created_at && (
                  <div className="text-[12px]" style={{ color: "var(--foreground-50)" }}>
                    {formatDate(row.created_at, "absolute")}
                  </div>
                )}
              </div>
              <div
                className="shrink-0 text-[13px] font-semibold"
                style={{ color: row.amount > 0 ? "var(--success)" : "var(--foreground)" }}
              >
                {row.amount > 0 ? "+" : "−"}
                {Math.abs(row.amount).toLocaleString("ru-RU")}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
