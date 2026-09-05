import { useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { variantUrl } from "@/lib/media/variants";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Img } from "@/components/ui/Img";
import { cn } from "@/lib/utils";

interface Props {
  /** Обложка. Нет обложки — вместо градиента во всю высоту остаётся полоса. */
  coverUrl?: string | null;
  avatarUrl?: string | null;
  /** Чем заменить аватар, если картинки нет: у сообщества это иконка направления. */
  avatarFallback?: ReactNode;
  name: string;
  /** Бейджи рядом с названием: тип сообщества, «официальный», роль. */
  badges?: ReactNode;
  /** Одна строка caption под названием: «128 участников · Активны сегодня». */
  meta?: ReactNode;
  description?: string | null;
  /** Кнопки действий. Что именно — знает страница, не оболочка. */
  actions?: ReactNode;
  /** Слот для «⋯ Ещё» — рядом с действиями. */
  menu?: ReactNode;
  /** Редактор брендинга поверх обложки (владельцу). */
  coverOverlay?: ReactNode;
  className?: string;
}

/**
 * Шапка сущности с профилем: обложка, аватар внахлёст, название, счётчики,
 * описание, строка действий.
 *
 * Одна на сообщества и каналы. Страницы совпадали по анатомии до порядка
 * блоков, но были набраны дважды — вплоть до кнопок-близнецов «Хочу своё
 * сообщество» и «Хочу свой канал». Здесь только оболочка: какие действия
 * показывать, что писать в счётчиках и какие вкладки идут ниже, решает
 * страница и передаёт слотами. Флагов вида `isChannel` внутри нет — как
 * только такой понадобится, компоненты надо разводить обратно.
 *
 * Высоты обложки — 110 на телефоне, 140 на планшете, 180 на широком экране.
 * До 05.09 у сообщества под шапку уходило 576 px до вкладок, и больше
 * трёхсот из них занимал пустой градиент на месте отсутствующей обложки.
 */
export function EntityHeader({
  coverUrl,
  avatarUrl,
  avatarFallback,
  name,
  badges,
  meta,
  description,
  actions,
  menu,
  coverOverlay,
  className,
}: Props) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const hasCover = Boolean(coverUrl);
  // Порог тот же, что в карточке ленты: решение принимается по длине текста и
  // одинаково на сервере и в браузере, поэтому кнопка не появляется после
  // первого кадра и ничего не двигает.
  const canExpand = (description ?? "").length > 140;

  return (
    <div className={cn("overflow-hidden", className)}>
      <div
        className={cn(
          "relative w-full overflow-hidden",
          // Без обложки — полоса 80, а не градиент во весь блок: пустое место
          // не должно занимать первый экран.
          hasCover ? "h-[110px] md:h-[140px] lg:h-[180px]" : "h-[80px]",
        )}
        style={{ background: "var(--background-surface)" }}
      >
        {hasCover && (
          <Img
            src={variantUrl(coverUrl, "medium")}
            width={1400}
            height={400}
            alt=""
            className="h-full w-full object-cover"
          />
        )}
        {coverOverlay}
      </div>

      <div className="px-[12px] pb-[12px] md:px-[16px]">
        <div className="flex items-end gap-[12px]">
          {/* Аватар заходит на обложку наполовину. Когда обложки нет и вместо
              неё полоса 80, нахлёст меньше — иначе аватар вылезает за верхний
              край карточки и обрезается. */}
          <span
            className={cn(
              "shrink-0 rounded-full p-[3px]",
              hasCover ? "-mt-[32px] md:-mt-[40px]" : "-mt-[20px] md:-mt-[24px]",
            )}
            style={{ background: "var(--background)" }}
          >
            {avatarUrl || !avatarFallback ? (
              <>
                <span className="md:hidden">
                  <UserAvatar src={avatarUrl} name={name} size={64} />
                </span>
                <span className="hidden md:inline-flex">
                  <UserAvatar src={avatarUrl} name={name} size={80} />
                </span>
              </>
            ) : (
              <span
                className="grid h-[64px] w-[64px] place-items-center rounded-full md:h-[80px] md:w-[80px]"
                style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
              >
                {avatarFallback}
              </span>
            )}
          </span>

          <div className="min-w-0 flex-1 pb-[4px]">
            <div className="flex min-w-0 items-center gap-[8px]">
              <h1
                className="truncate font-display text-[20px] font-bold leading-tight"
                style={{ color: "var(--foreground)" }}
              >
                {name}
              </h1>
              {badges}
            </div>
            {meta && (
              <div
                className="mt-[2px] truncate text-[13px]"
                style={{ color: "var(--foreground-50)" }}
              >
                {meta}
              </div>
            )}
          </div>
        </div>

        {description && (
          <p
            className={cn(
              "mt-[8px] whitespace-pre-line text-[15px] leading-[1.4]",
              !expanded && "line-clamp-2",
            )}
            style={{ color: "var(--foreground-70)" }}
          >
            {description}
          </p>
        )}
        {canExpand && (
          <button
            type="button"
            onClick={() => setExpanded((v) => !v)}
            className="mt-[2px] text-[13px] font-semibold transition-opacity hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            {expanded ? t("pages.shared.collapse") : t("pages.shared.showAll")}
          </button>
        )}

        {(actions || menu) && (
          <div className="mt-[12px] flex flex-wrap items-center gap-[8px]">
            {actions}
            {menu}
          </div>
        )}
      </div>
    </div>
  );
}
