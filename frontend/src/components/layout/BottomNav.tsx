import { useEffect, useRef } from "react";
import { Link, useRouterState } from "@tanstack/react-router";
import { Newspaper, Users2, MessageSquare, Megaphone, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { Icon as SlotIcon } from "@/components/ui/Icon";
import { navSlotKey } from "@/lib/icon-slots";
import { getActiveSection } from "@/lib/routes";
import { scrollSectionToTop } from "@/lib/scroll-top";
import { useUnreadMessagesTotal } from "@/lib/messenger";
import { useFeatureFlag } from "@/lib/config/featureFlags";
import { GuestGuardLink } from "@/components/access/GuestGuardLink";
import { NAV_ROUTE_TO_ACTION } from "@/lib/feed-guest-access/routes";

type Item = {
  to: "/feed" | "/communities" | "/messenger" | "/ads" | "/profile";
  labelKey: string;
  icon: typeof Newspaper;
  section: string;
};

/*
 * Пять пунктов, и состав закреплён решением D4: Лента, Сообщества,
 * Сообщения, Объявления, Профиль.
 *
 * «Друзей» здесь был шестой пункт. Он ушёл в меню аватара (UserMenu) вместе
 * со счётчиком входящих заявок: панель — для разделов, куда человек ходит
 * постоянно, а заявки в друзья приходят редко и ждать не заставляют.
 *
 * Убирать пункт отсюда можно было только вместе с добавлением в меню:
 * боковая колонка, где «Друзья» тоже есть, показывается от 768px и шире
 * (Sidebar: `md:flex`), а панель — наоборот, `md:hidden`. На телефоне она
 * единственная навигация, и одно удаление отняло бы доступ к разделу
 * и к счётчику заявок, а не перенесло бы их.
 */
const ALL_ITEMS: Item[] = [
  { to: "/feed", labelKey: "nav.feed", icon: Newspaper, section: "feed" },
  { to: "/communities", labelKey: "nav.communities", icon: Users2, section: "communities" },
  { to: "/messenger", labelKey: "nav.messagesTab", icon: MessageSquare, section: "messenger" },
  { to: "/ads", labelKey: "nav.ads", icon: Megaphone, section: "ads" },
  { to: "/profile", labelKey: "nav.profile", icon: User, section: "profile" },
];
export function BottomNav() {
  const { t } = useTranslation();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const activeSection = getActiveSection(pathname);
  const communitiesEnabled = useFeatureFlag("communitiesEnabled");
  const ITEMS = ALL_ITEMS.filter((i) => i.to !== "/communities" || communitiesEnabled);
  // Aggregate unread messages — live via the realtime store. Stays 0 until
  // conversations are loaded, so the badge only shows when data exists.
  const unreadMessages = useUnreadMessagesTotal();

  /*
   * Панель сообщает, сколько места снизу она занимает, — в
   * `--bottom-nav-occupied`.
   *
   * Нужно это полосе согласия на cookie: она `position: fixed` и должна
   * встать над панелью, а не под ней. Раньше полоса брала отступ из
   * `--bottom-nav-space` по правилу `max-lg:`, то есть на глаз, и промахивалась
   * дважды:
   *
   * — панель скрыта с 768 px (`md:hidden`), а полоса отступала до 1024 px,
   *   и в этом промежутке она поднималась над пустотой;
   * — страницы входа рисуются вне `AppLayout`, панели там нет вовсе, но
   *   полоса всё равно отступала на её 60 px. Замер 09.10 на 320 px с
   *   открытой клавиатурой: окно 268 px, полоса занимала 137 — больше
   *   половины экрана, — и под неё уходили все четыре поля формы
   *   регистрации и кнопка.
   *
   * Поэтому величину публикует сама панель, по своему же прямоугольнику.
   * Когда `md:hidden` её прячет, прямоугольник нулевой — и значение
   * становится нулём само, без повторения точки перелома в двух местах.
   * Высота панели равна `--bottom-nav-space` по построению: `--bottom-nav-h`
   * у списка плюс `--safe-bottom` отступом снизу.
   */
  const панельRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    const root = document.documentElement;
    const панель = панельRef.current;
    if (!панель) return;
    const опубликовать = () => {
      const h = панель.getBoundingClientRect().height;
      root.style.setProperty("--bottom-nav-occupied", `${Math.ceil(h)}px`);
    };
    опубликовать();
    const ro = new ResizeObserver(опубликовать);
    ro.observe(панель);
    /* ResizeObserver на `display: none` узле молчит в части браузеров —
       поэтому точка перелома ловится ещё и обычным resize. */
    window.addEventListener("resize", опубликовать);
    return () => {
      ro.disconnect();
      window.removeEventListener("resize", опубликовать);
      root.style.removeProperty("--bottom-nav-occupied");
    };
  }, []);

  return (
    <nav
      ref={панельRef}
      // md:hidden, не lg: с 768 навигация живёт в боковой колонке значков.
      className="fixed bottom-0 left-0 right-0 z-[var(--z-sticky)] md:hidden"
      style={{
        background: "color-mix(in oklab, var(--background) 94%, transparent)",
        backdropFilter: "saturate(180%) blur(14px)",
        WebkitBackdropFilter: "saturate(180%) blur(14px)",
        borderTop: "1px solid var(--border)",
        paddingBottom: "var(--safe-bottom)",
      }}
    >
      <ul
        className="grid items-stretch"
        style={{
          height: "var(--bottom-nav-h)",
          gridTemplateColumns: `repeat(${ITEMS.length}, 1fr)`,
        }}
      >
        {ITEMS.map((it) => (
          <NavTab
            key={it.to}
            item={it}
            label={t(it.labelKey)}
            active={activeSection === it.section}
            badge={it.section === "messenger" ? unreadMessages : 0}
          />
        ))}
      </ul>
    </nav>
  );
}

function NavTab({
  item,
  label,
  active,
  badge,
}: {
  item: Item;
  label: string;
  active: boolean;
  badge: number;
}) {
  const actionKey = NAV_ROUTE_TO_ACTION[item.to];
  // VK/Авито-поведение: повторный тап по активному разделу не навигирует, а
  // прокручивает наверх и просит секцию обновиться. Ловим в фазе захвата, до
  // обработчика самой ссылки, поэтому Link/GuestGuardLink менять не нужно.
  const onReTap = active
    ? (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        scrollSectionToTop(item.section);
      }
    : undefined;
  const content = (
    <>
      <span className="relative inline-flex">
        <SlotIcon
          slot={navSlotKey(item.section)}
          inheritColor
          size={22}
          strokeWidth={active ? 2.4 : 2}
        />
        {badge > 0 && (
          <span
            className="absolute -right-[7px] -top-[5px] grid min-w-[15px] place-items-center rounded-full px-[3px] tabular-nums"
            style={{
              height: 15,
              fontSize: 9,
              fontWeight: 700,
              color: "var(--accent-foreground)",
              background: "var(--accent-fill)",
              boxShadow: "0 0 0 2px var(--background)",
            }}
          >
            {badge > 9 ? "9+" : badge}
          </span>
        )}
      </span>
      {/* Длинные названия («Сообщества», «Объявления») не влезают в узкую
          колонку.

          Подпись занимала всю колонку целиком, и соседние подписи смыкались
          вплотную: замер 07.09 при 375 — пять зазоров ровно по нулю,
          «Сообщества Сообщения Объявления» читались как сплошной набор букв.
          Внутренние отступы тут не помогают: коробка остаётся во всю колонку,
          нужен внешний отступ.

          Значения подобраны замером на живой странице, не на глаз, и мерились
          при шести пунктах:
            375: зазор 7,7 px, кегль 8,8, обрезки нет
            320: зазор 5,9 px, кегль 7,5, обрезки нет
          Кегль пришлось опустить — при прежних 9,8 «Сообщества» упиралось в
          многоточие. truncate остаётся страховкой.

          После D4 пунктов пять, то есть колонка только шире, и значения выше
          остаются с запасом: замер 05.10 при пяти пунктах дал колонку 64 px
          на 320 и 72 px на 360, обрезки нет ни на одной ширине. */}
      <span
        className="truncate text-center font-medium"
        style={{
          marginInline: 2,
          maxWidth: "calc(100% - 4px)",
          fontSize: "clamp(7.5px, 2.35vw, 10px)",
          letterSpacing: "0",
          lineHeight: 1.15,
        }}
      >
        {label}
      </span>
    </>
  );

  return (
    <li className="flex min-w-0" onClickCapture={onReTap}>
      {actionKey ? (
        <GuestGuardLink
          actionKey={actionKey}
          to={item.to}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] transition-colors duration-150"
          style={{ color: active ? "var(--accent)" : "var(--foreground-50)" }}
        >
          {content}
        </GuestGuardLink>
      ) : (
        <Link
          to={item.to}
          className="flex min-w-0 flex-1 flex-col items-center justify-center gap-[3px] transition-colors duration-150"
          style={{ color: active ? "var(--accent)" : "var(--foreground-50)" }}
        >
          {content}
        </Link>
      )}
    </li>
  );
}
