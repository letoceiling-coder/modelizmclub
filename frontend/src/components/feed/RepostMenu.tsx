import { useState } from "react";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useTranslation } from "react-i18next";
import { useNavigate } from "@tanstack/react-router";
import { Repeat2, Share2, MessageSquare, Link2, Check, ArrowLeft, Forward } from "lucide-react";
import { toast } from "@/lib/toast";
import { actions } from "@/lib/store";
import { userById } from "@/lib/user-registry";
import { sendPostShareMessage } from "@/lib/api/chat";
import { useGuestAccessOptional } from "@/components/access/GuestAccessProvider";
import { SHARE_TARGETS, type ShareTarget } from "@/lib/share-targets";
import { runShareTarget } from "@/lib/share-action";
import { useDialogs } from "@/lib/messenger";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

/**
 * Меню «Поделиться» у записи — одна реализация на карточку и на окно
 * просмотра.
 *
 * РАНЬШЕ МЕНЮ БЫЛО `position: absolute` внутри своей кнопки. В ленте это
 * работало; в окне просмотра записи — нет. Панель окна объявлена
 * `lg:overflow-hidden`, и меню, открываясь вверх, обрезалось её верхним
 * краем. Замер 06.10, /feed → нажатие по фотографии → панель справа, 1280:
 *
 *   панель            [860,54,380,792]  overflow hidden
 *   кнопка «Репост»   [931,111,44,44]
 *   «Репост в ленту»  [824,-17,258,40]  за верхним краем ОКНА ЭКРАНА
 *   «Отправить…»      [824, 22,258,40]  выше края панели (54) — обрезан
 *   «Поделиться»      [824, 63,258,40]  единственный целиком видимый
 *
 * Это и есть находка владельца: «виден только пункт „Поделиться“, пункты
 * выше нажимаются, но не видны». В карточке ленты она не воспроизводилась,
 * потому что у карточки нет обрезающего родителя, — и первая проверка
 * (05.10) смотрела именно карточку.
 *
 * Поднимать слой было бы бесполезно: обрезает не наложение, а `overflow`
 * родителя, и внутри него никакой `z-index` не помогает. Поэтому меню
 * вынесено из потока в portal существующим средством проекта — `DropdownMenu`
 * (Radix) из `@/components/ui/dropdown-menu`. Оно же даёт и остальное,
 * что требовал владелец: переворот вниз, когда вверх не помещается
 * (`avoidCollisions` включён по умолчанию), отступ от краёв
 * (`collisionPadding`), слой `--z-popover` из шкалы — 55, то есть над
 * лайтбоксом (`--z-modal`, 50), ограничение высоты по доступному месту,
 * Escape, нажатие мимо и стрелки клавиатуры.
 *
 * `modal={false}` намеренно: окно просмотра — свой portal, а не Radix
 * Dialog. В модальном режиме Radix погасил бы указатель на всём остальном
 * документе, то есть на самом окне просмотра под меню.
 */

interface Props {
  postId: string;
  reposted: boolean;
  count: number;
  onRepost: () => void;
  disabled?: boolean;
  /** Класс кнопки — приходит из строки действий, чтобы репост выглядел
   *  и вёл себя ровно как соседи. */
  className: string;
}

type View = "main" | "chats" | "share";

export function RepostMenu({
  postId,
  reposted,
  count,
  onRepost,
  disabled = false,
  className,
}: Props) {
  const { t } = useTranslation();
  const guest = useGuestAccessOptional();
  const [open, setOpen] = useState(false);
  const [view, setView] = useState<View>("main");
  const [copied, setCopied] = useState(false);
  const { dialogs } = useDialogs();
  const navigate = useNavigate();

  const url = () => {
    const origin = typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/?post=${postId}`;
  };

  const close = () => {
    setOpen(false);
    setView("main");
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(url());
      setCopied(true);
      toast.success(t("components.repostMenu.linkCopied"));
      setTimeout(() => setCopied(false), 1200);
    } catch {
      toast.error(t("components.repostMenu.copyFailed"));
    }
  };

  // The toast lives in the caller: a guest's repost is intercepted by the
  // auth guard, so announcing success here would lie.
  const repostToFeed = () => {
    onRepost();
    close();
  };

  const shareTo = (target: ShareTarget) => {
    void runShareTarget(target, url());
    close();
  };

  const openChats = () => {
    if (guest) {
      /*
       * Гостя перехватывает окно гейта. Меню при этом закрывается: оно
       * живёт в portal на слое 55, окно гейта — на 70, и оставлять под ним
       * раскрытое меню значит держать на экране два наложения сразу.
       */
      close();
      guest.guardAction("messenger.send", () => {
        setOpen(true);
        setView("chats");
      });
      return;
    }
    setView("chats");
  };

  const sendToChat = async (dialogId: string, partnerName: string) => {
    close();
    try {
      const message = await sendPostShareMessage(dialogId, postId);
      actions.addMessage(dialogId, message);
      toast.success(t("components.repostMenu.sentTo", { name: partnerName }));
    } catch {
      // Fall back to a plain link if the post card couldn't be attached
      // (e.g. the post is no longer published) — the chat still opens.
      actions.queuePendingMessage(dialogId, `🔗 ${t("components.repostMenu.postTitle")}: ${url()}`);
      toast.error(t("components.repostMenu.sendFailed"));
    }
    navigate({ to: "/messenger", search: { chat: dialogId } });
  };

  /* Escape во вложенном виде возвращает в корень меню, а не закрывает его. */
  const onEscape = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" && view !== "main") {
      e.preventDefault();
      setView("main");
    }
  };

  return (
    <DropdownMenu
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setView("main");
      }}
      modal={false}
    >
      <DropdownMenuTrigger asChild>
        <button
          disabled={disabled}
          // Тот же класс, что у соседей по строке действий. Здесь лежала его
          // копия — без подсветки наведения: репост был единственной кнопкой
          // ряда, которая на курсор не отзывалась.
          className={className}
          style={{
            color: reposted ? "var(--accent)" : "var(--foreground-70)",
            background: open ? "var(--background-surface)" : "transparent",
          }}
          aria-label={t("components.repostMenu.ariaLabel")}
          aria-disabled={disabled}
        >
          {/* Простая стрелка «Поделиться», как у VK, — и в ленте, и в
              просмотрщике. Две петли Repeat2 остаются за пунктом «Репост» в
              меню: это одно из действий за кнопкой, а не сама кнопка. */}
          <Forward className="h-[20px] w-[20px]" />
          {count > 0 && <span className="tabular-nums">{count}</span>}
        </button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        /*
         * Вверх, по середине кнопки — как было. Разница в том, что теперь
         * это просьба, а не жёсткая раскладка: не поместилось вверх —
         * Radix сам открывает вниз, не поместилось по ширине — сдвигает
         * внутрь края. `collisionPadding` 12 оставляет зазор от краёв
         * экрана; `w-[min(260px,…)]` не даёт меню быть шире окна на 320.
         */
        side="top"
        align="center"
        sideOffset={8}
        collisionPadding={12}
        onKeyDown={onEscape}
        className="w-[min(260px,calc(100vw-24px))] rounded-[12px] border p-0"
        style={{
          background: "var(--background-elevated)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        {view === "main" && (
          <>
            <Item
              onClick={repostToFeed}
              icon={Repeat2}
              label={
                reposted
                  ? t("components.repostMenu.undoRepost")
                  : t("components.repostMenu.repostToFeed")
              }
              accent
            />
            {/* Вложенный вид — меню остаётся раскрытым. */}
            <Item
              onClick={openChats}
              icon={MessageSquare}
              label={t("components.repostMenu.sendToMessages")}
              keepOpen
            />
            <div className="border-t" style={{ borderColor: "var(--border)" }} />
            <Item
              onClick={() => setView("share")}
              icon={Share2}
              label={t("components.repostMenu.share")}
              keepOpen
            />
          </>
        )}
        {view === "share" && (
          <div>
            <Back label={t("components.repostMenu.share")} onClick={() => setView("main")} />
            {SHARE_TARGETS.map((target) => (
              <Item
                key={target.id}
                onClick={() => shareTo(target)}
                icon={Share2}
                label={target.label}
              />
            ))}
            <Item
              onClick={copyLink}
              icon={copied ? Check : Link2}
              label={
                copied ? t("components.repostMenu.copied") : t("components.repostMenu.copyLink")
              }
              accent={copied}
            />
          </div>
        )}
        {view === "chats" && (
          <div>
            <Back label={t("components.repostMenu.whereToSend")} onClick={() => setView("main")} />
            <div className="max-h-[280px] overflow-y-auto">
              {dialogs.length === 0 ? (
                <div
                  className="px-[14px] py-[16px] text-center text-[12px]"
                  style={{ color: "var(--foreground-50)" }}
                >
                  {t("components.repostMenu.noDialogs")}
                </div>
              ) : (
                dialogs.map((d) => {
                  const u = userById(d.userId);
                  return (
                    <DropdownMenuItem
                      key={d.id}
                      onSelect={() => void sendToChat(d.id, u.name)}
                      className="flex w-full items-center gap-[10px] rounded-none px-[14px] py-[8px] text-left focus:bg-[var(--background-surface)]"
                    >
                      <UserAvatar src={u.avatar} name={u.name} size={36} />
                      <span className="text-[13px]" style={{ color: "var(--foreground)" }}>
                        {u.name}
                      </span>
                    </DropdownMenuItem>
                  );
                })
              )}
            </div>
          </div>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/** Возврат в корень меню. Пункт меню, а не обычная кнопка: иначе стрелками
 *  клавиатуры на него не попасть. */
function Back({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <DropdownMenuItem
      onSelect={(e) => {
        e.preventDefault();
        onClick();
      }}
      className="flex w-full items-center gap-[8px] rounded-none border-b px-[14px] py-[10px] text-[13px] font-semibold focus:bg-[var(--background-surface)]"
      style={{ color: "var(--foreground)", borderColor: "var(--border)" }}
    >
      <ArrowLeft className="h-[14px] w-[14px]" /> {label}
    </DropdownMenuItem>
  );
}

function Item({
  icon: Icon,
  label,
  onClick,
  accent,
  keepOpen,
}: {
  icon: typeof Repeat2;
  label: string;
  onClick: () => void;
  accent?: boolean;
  /** Пункт открывает вложенный вид — меню не закрывается. */
  keepOpen?: boolean;
}) {
  return (
    <DropdownMenuItem
      onSelect={(e) => {
        if (keepOpen) e.preventDefault();
        onClick();
      }}
      className="flex w-full items-center gap-[10px] rounded-none px-[14px] py-[10px] text-left text-[13px] focus:bg-[var(--background-surface)]"
      style={{ color: "var(--foreground)" }}
    >
      <Icon
        className="h-[16px] w-[16px]"
        style={{ color: accent ? "var(--accent)" : "var(--foreground-70)" }}
      />
      {label}
    </DropdownMenuItem>
  );
}
