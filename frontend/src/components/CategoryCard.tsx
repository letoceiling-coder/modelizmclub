import { Link } from "@tanstack/react-router";
import { ChevronRight } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { Category, CategoryChild } from "@/lib/mock";
import { CategoryIcon, IconBox } from "@/components/ui/Icon";

/**
 * Пункт списка — всегда одна строка (`block truncate`). Иначе число строк
 * зависит от шрифта: пока грузится веб-шрифт, запасной шире, длинная строка
 * третьего уровня переносилась, а после подмены сжималась в одну — и всё
 * ниже подпрыгивало на 20 px. CLS 0,018–0,031 при прямой загрузке на 1440
 * и 768, замер на проде 12.09.
 */
const childLinkCls =
  "block truncate rounded-[4px] transition-colors hover:text-[var(--accent)] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]";

/** Адрес узла любой глубины — один сегмент: `/categories/{slug}`. */
function nodeParam(node: CategoryChild): string {
  return node.slug ?? node.id;
}

/**
 * Направление на странице «Все направления» (`/categories`): шапка ведёт
 * в само направление, ниже — его подкатегории, под подкатегорией третий
 * уровень отдельными строками с отступом. Как общий список категорий у
 * Авито: до нужного раздела — один щелчок со страницы.
 *
 * Раньше вся карточка была одной ссылкой с описанием и кнопкой «Открыть»:
 * подкатегорий на странице не было, до них добирались только через
 * направление.
 */
export function CategoryCard({ c }: { c: Category }) {
  const { t } = useTranslation();
  return (
    <section className="flex flex-col rounded-xl border bg-card p-4">
      <Link
        to="/categories/$id"
        params={{ id: c.slug ?? c.id }}
        className="group flex items-center gap-3 rounded-[8px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent)]"
        aria-label={t("pages.categories.openCategory", { name: c.name })}
      >
        <IconBox size="md" variant="elevated" className="h-11 w-11 shrink-0">
          <CategoryIcon categoryId={c.id} name={c.icon} iconImageUrl={c.iconImageUrl} fill />
        </IconBox>
        <div className="min-w-0 flex-1">
          <h3 className="font-display text-base font-semibold transition-colors group-hover:text-[var(--accent)]">
            {c.name}
          </h3>
          <p className="text-xs text-muted-foreground">
            {/*
              Два числа — два ключа со своими формами.
              Раньше подпись была одной строкой с жёстким «участников ·
              комнат», и любое число получало родительный падеж: «1 комнат»,
              «3 комнат». Плюс `count` приходил строкой после
              `toLocaleString()` — i18next выбирает форму по числу, а строку
              молча принимает за единственную, так что форма не менялась бы
              и с правильными ключами.
            */}
            {t("pages.categories.membersCount", { count: c.members })}
            {" · "}
            {t("pages.categories.roomsCount", { count: c.subcategories.length })}
          </p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
      </Link>

      {c.subcategories.length > 0 && (
        <ul className="mt-3 space-y-[4px] border-t pt-3" style={{ borderColor: "var(--border)" }}>
          {c.subcategories.map((s) => (
            <li key={s.id}>
              <Link
                to="/categories/$id"
                params={{ id: nodeParam(s) }}
                className={`${childLinkCls} text-[14px] leading-[20px]`}
              >
                {s.name}
              </Link>
              {s.children && s.children.length > 0 && (
                <ul className="mt-[4px] space-y-[4px] pl-[12px]">
                  {s.children.map((leaf) => (
                    <li key={leaf.id}>
                      <Link
                        to="/categories/$id"
                        params={{ id: nodeParam(leaf) }}
                        className={`${childLinkCls} text-[13px] leading-[20px] text-muted-foreground`}
                      >
                        {leaf.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
