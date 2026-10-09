import { Link } from "@tanstack/react-router";
import { useTranslation } from "react-i18next";
import { Img } from "@/components/ui/Img";
import { variantUrl } from "@/lib/media/variants";
import type { DialogAdRef } from "@/lib/mock";

/**
 * Объявление, к которому привязана переписка.
 *
 * Решение Ж3 от 09.10, пункт 2: «в шапке чата и в списке диалогов видны
 * название, цена и фото объявления, по нажатию открывается объявление».
 *
 * До 09.10 объявление было видно только карточкой внутри самой переписки —
 * вступительным сообщением. Значит в списке диалогов двадцать переписок по
 * двадцати объявлениям выглядели одинаково: имя и последняя строка. Продавцу
 * приходилось открывать каждую, чтобы вспомнить, о каком товаре речь.
 *
 * Один компонент на два места нарочно: иначе шапка и список разошлись бы —
 * так уже было с правилом дружбы, которое жило в трёх местах по-разному.
 *
 * `variant` меняет только плотность. `strip` — полоса под шапкой чата,
 * `row` — строка в списке диалогов, где места мало и фото меньше.
 */
export function ConversationListingRef({
  listing,
  variant = "strip",
}: {
  listing: DialogAdRef;
  variant?: "strip" | "row";
}) {
  const { t } = useTranslation();
  const компактно = variant === "row";
  const сторона = компактно ? 28 : 40;

  const содержимое = (
    <>
      {listing.image ? (
        <Img
          src={variantUrl(listing.image, "thumb")}
          alt=""
          width={сторона}
          height={сторона}
          className="shrink-0 rounded-[6px] object-cover"
          style={{ width: сторона, height: сторона }}
        />
      ) : (
        <div
          className="shrink-0 rounded-[6px]"
          style={{ width: сторона, height: сторона, background: "var(--background-surface)" }}
        />
      )}
      <span className="min-w-0 flex-1 truncate" title={listing.title}>
        {listing.title}
      </span>
      <span className="shrink-0 tabular-nums" style={{ color: "var(--foreground)" }}>
        {listing.price.toLocaleString("ru")} ₽
      </span>
    </>
  );

  /*
   * В списке диалогов — не ссылка.
   *
   * Строка списка сама нажимаема: она открывает переписку. Ссылка внутри
   * неё дала бы ссылку внутри кнопки — то, что прямо запрещено правилом 3.4.3
   * («кнопка внутри ссылки»), и на телефоне палец всё равно попадал бы то
   * туда, то сюда. Поэтому здесь объявление только называется, а открывается
   * оно из шапки самой переписки.
   */
  if (компактно) {
    return (
      <span
        className="mt-[2px] flex items-center gap-[6px] text-[12px]"
        style={{ color: "var(--foreground-50)" }}
      >
        {содержимое}
      </span>
    );
  }

  return (
    <Link
      to="/ads/$id"
      params={{ id: String(listing.id) }}
      className="flex items-center gap-[10px] border-b px-[20px] py-[8px] text-[13px]"
      style={{
        borderColor: "var(--border)",
        background: "var(--background-surface)",
        color: "var(--foreground-70)",
      }}
      aria-label={t("pages.messenger.openListing", { title: listing.title })}
    >
      {содержимое}
    </Link>
  );
}
