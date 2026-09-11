import { useState, type ComponentType, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { variantUrl } from "@/lib/media/variants";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { Img } from "@/components/ui/Img";
import { Button } from "@/components/ui/button";
import { coverPlaceholder } from "@/lib/placeholder-image";
import { cn } from "@/lib/utils";

/**
 * Действие в шапке сущности.
 *
 * Порядок в массиве — это и есть важность: первое остаётся главным, второе
 * второстепенным с подписью, остальные сворачиваются в значок. Страница
 * решает, что важнее, оболочка — как это показать на каждой ширине.
 */
export interface EntityAction {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  onClick: () => void;
  variant?: "default" | "outline";
  disabled?: boolean;
}

/** Сколько действий остаётся с подписью на широком экране. */
const LABELLED = 2;

interface Props {
  /** Обложка. Нет обложки — градиент из имени той же высоты. */
  coverUrl?: string | null;
  avatarUrl?: string | null;
  name: string;
  /** Бейджи рядом с названием: тип сообщества, «официальный», роль. */
  badges?: ReactNode;
  /** Одна строка caption под названием: «128 участников · Активны сегодня». */
  meta?: ReactNode;
  description?: string | null;
  /** Действия по убыванию важности. Что именно — знает страница, не оболочка. */
  actions?: EntityAction[];
  /** Слот для «⋯ Ещё» — последним в строке действий. */
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
 * Обложка: 120 на телефоне, 160 на планшете, 200 на широком экране. Скругление
 * только сверху — снизу она переходит в карточку шапки без шва.
 */
export function EntityHeader({
  coverUrl,
  avatarUrl,
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

  const list = actions ?? [];
  const [primary, ...secondary] = list;

  return (
    <div className={cn("overflow-hidden", className)}>
      <div
        className="relative h-[120px] w-full overflow-hidden rounded-t-[12px] md:h-[160px] lg:h-[200px]"
        style={
          hasCover
            ? { background: "var(--background-surface)" }
            : {
                // Градиент из имени вместо ровной заливки. Данные не выдумываем —
                // это оформление, а не подстановка несуществующей картинки,
                // поэтому строится из самого названия и одинаково выглядит при
                // каждом заходе.
                backgroundImage: `url("${coverPlaceholder(name)}")`,
                backgroundSize: "cover",
                backgroundPosition: "center",
              }
        }
      >
        {hasCover && (
          <Img
            src={variantUrl(coverUrl, "medium")}
            width={1400}
            height={400}
            alt=""
            // Самая большая картинка первого экрана. Страница кладёт на неё
            // preload в head (см. head() маршрута), и приоритет здесь должен
            // совпадать: иначе браузер тянет её дважды по разным правилам.
            priority
            className="h-full w-full object-cover"
          />
        )}
        {coverOverlay}
      </div>

      <div className="px-5 pb-4">
        <div className="flex items-start gap-3">
          {/*
            Кольцо-отбивка вокруг аватара.
            Без него нижний край обложки проходил ровно по кружку, и аватар
            выглядел разрезанным линией. Обводка цветом фона карточки
            возвращает ощущение, что он лежит на обложке, а не встроен в шов.

            Нахлёст ровно наполовину: аватар 88 заходит на 44, 72 — на 36.
            Отрицательный отступ на четыре пикселя больше, потому что его
            считают от внешнего края кольца, а не от самого кружка.
          */}
          <span
            /* inline-flex, а не inline: у инлайнового контейнера остаётся
               разрыв строки под содержимым, и кольцо на 375 выходило 80×86 —
               то есть овалом, а не кружком. */
            className="-mt-10 inline-flex shrink-0 rounded-full p-1 md:-mt-12"
            style={{ background: "var(--background)" }}
          >
            {/*
              Заглушка — инициалы, а не значок направления. Значок одинаков у
              всех сообществ одного направления и различать их не помогает;
              инициалы UserAvatar строит из самого названия.
            */}
            <span className="inline-flex md:hidden">
              <UserAvatar src={avatarUrl} name={name} size={72} />
            </span>
            <span className="hidden md:inline-flex">
              <UserAvatar src={avatarUrl} name={name} size={88} />
            </span>
          </span>

          {/* Двенадцать сверху — от нижнего края обложки до названия. Раньше
              текст равнялся по низу аватара и прилипал к нему. */}
          <div className="min-w-0 flex-1 pt-3">
            <div className="flex min-w-0 items-center gap-2">
              <h1
                className="truncate font-display text-[20px] font-bold leading-tight"
                style={{ color: "var(--foreground)" }}
              >
                {name}
              </h1>
              {badges}
            </div>
            {meta && (
              <div className="mt-1 truncate text-[13px]" style={{ color: "var(--foreground-50)" }}>
                {meta}
              </div>
            )}
          </div>
        </div>

        {description && (
          <p
            className={cn(
              "mt-3 whitespace-pre-line text-[15px] leading-[1.4]",
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
            className="hit-target mt-1 cursor-pointer text-[13px] font-semibold transition-opacity hover:opacity-80"
            style={{ color: "var(--accent)" }}
          >
            {expanded ? t("pages.shared.collapse") : t("pages.shared.showAll")}
          </button>
        )}

        {(list.length > 0 || menu) && (
          /*
           * Одна строка на десктопе, без переносов: пять кнопок с подписями
           * («Вы подписаны», «Управление сообществом», «Открыть чат»,
           * «Предложить проект», «Поделиться») разъезжались на три строки в
           * 680, а «⋯» уходило на свою. Подписи остаются у первых двух,
           * остальные — значки 36×36.
           *
           * До 768 главное действие занимает всю ширину: это то, ради чего
           * страницу открыли, и на телефоне ему незачем делить строку с
           * второстепенными. Остальные уходят под ним в ряд значками.
           */
          <div className="mt-4 flex flex-col gap-2 md:flex-row md:flex-nowrap md:items-center">
            {primary && (
              <Button
                onClick={primary.onClick}
                disabled={primary.disabled}
                variant={primary.variant ?? "default"}
                size="sm"
                className="w-full shrink-0 gap-[6px] md:w-auto"
                aria-label={primary.label}
              >
                <primary.icon size={15} />
                <span>{primary.label}</span>
              </Button>
            )}
            {(secondary.length > 0 || menu) && (
              <div className="flex items-center gap-2">
                {secondary.map((action, i) => {
                  const Icon = action.icon;
                  // Второе действие с подписью — но только от 768: ниже оно
                  // становится значком наравне с остальными.
                  const labelled = i < LABELLED - 1;
                  return (
                    <Button
                      key={action.id}
                      onClick={action.onClick}
                      disabled={action.disabled}
                      variant={action.variant ?? "outline"}
                      size="sm"
                      className={cn("w-9 shrink-0 gap-[6px] px-0", labelled && "md:w-auto md:px-3")}
                      title={action.label}
                      aria-label={action.label}
                    >
                      <Icon size={15} />
                      <span className={cn("hidden", labelled && "md:inline")}>{action.label}</span>
                    </Button>
                  );
                })}
                {menu}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
