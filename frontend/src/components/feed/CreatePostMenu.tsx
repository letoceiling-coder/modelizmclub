import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus, Send } from "lucide-react";
import { m } from "framer-motion";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHoverDropdown } from "@/lib/hooks/useHoverDropdown";
import type { Channel } from "@/lib/channels";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import type { User } from "@/lib/mock";
import { TAP_TARGET_44 } from "@/lib/tap-target";
import { cn } from "@/lib/utils";

export type ComposerKind = "photo" | "video";
export type ComposerSourceKind = "profile" | "channel";

export interface ComposerSelection {
  kind: ComposerKind;
  source: ComposerSourceKind;
  /** Present iff source === "channel". */
  channel?: Channel;
}

export interface ComposerDraft {
  text: string;
  files: File[];
}

interface Props {
  me: User;
  onCompose: (selection: ComposerSelection, draft: ComposerDraft) => void;
}

const ROW_CLASS =
  "flex min-h-[52px] w-full cursor-pointer items-center rounded-[var(--r-card-sm)] px-3 text-left text-[15px] font-medium transition-colors hover:bg-[var(--background-surface)]";

const MENU_ITEM_CLASS =
  "flex w-full cursor-pointer select-none items-center rounded-[var(--r-card-sm)] px-3 py-2 text-[14px] font-medium transition-colors hover:bg-[var(--background-surface)] focus-visible:bg-[var(--background-surface)] focus-visible:outline-none";

const BTN_SIZE = 36;
// Кнопки композера нарисованы 36. Зону нажатия до 44 добирает псевдоэлемент,
// а клип-контейнеру нужны эти же 4px паддинга с каждой стороны, иначе он её
// срежет (замерено на проде: 37 вместо 44).
const TAP_PAD = 4;
const ACTION_GAP = 8;
const ACTIONS_WIDTH_EXPANDED = BTN_SIZE * 2 + ACTION_GAP;

/**
 * Два действия за «плюсом»: запись и видео.
 *
 * Было четыре ветки и вложенное подменю. «Фото или видео с устройства»
 * открывало системный выбор файлов до того, как человек решил, что вообще
 * пишет; файлы всё равно прикрепляются внутри формы, так что этот пункт
 * только уводил в сторону. Выбор источника — «от профиля» или «от канала» —
 * жил подменю, которое раскрывалось вправо (`absolute left-full`) и на
 * широком экране заезжало на правую панель направлений: композер стоит у
 * правого края центральной колонки, и раскрываться вправо ему некуда.
 *
 * Запись от имени канала никуда не делась — она там, где ей место, на
 * странице самого канала: у него свой композер (`routes/channel.$id.tsx`).
 */
function KindPickerMenu({
  onSelect,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
  flat = false,
}: {
  onSelect: (kind: ComposerKind, source: ComposerSourceKind) => void;
  className?: string;
  style?: React.CSSProperties;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  /** Flat list for mobile sheet (no hover submenus). */
  flat?: boolean;
}) {
  const { t } = useTranslation();
  const items = [
    { kind: "photo" as const, label: t("components.createPostMenu.post") },
    { kind: "video" as const, label: t("components.createPostMenu.video") },
  ];

  return (
    <div
      role="menu"
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {items.map((item) => (
        <button
          key={item.kind}
          type="button"
          className={flat ? ROW_CLASS : MENU_ITEM_CLASS}
          style={flat ? { color: "var(--foreground)" } : undefined}
          onClick={() => onSelect(item.kind, "profile")}
        >
          {item.label}
        </button>
      ))}
    </div>
  );
}

function ComposerActions({
  text,
  files,
  onSend,
  onSelectKind,
  isMobile = false,
  className,
  sendable = true,
}: {
  text: string;
  files: File[];
  onSend: () => void;
  onSelectKind: (kind: ComposerKind, source: ComposerSourceKind) => void;
  isMobile?: boolean;
  className?: string;
  /** Есть ли рядом поле ввода. Без него кнопка отправки не рендерится вовсе:
   *  скрытая прозрачностью кнопка попадала в серверную разметку и портила
   *  проверку «ни одного невидимого узла в первом экране». */
  sendable?: boolean;
}) {
  const { t } = useTranslation();
  const showSend = sendable && text.trim().length > 1;
  const {
    open,
    setOpen,
    wrapperRef,
    onWrapperMouseEnter,
    onWrapperMouseLeave,
    onContentMouseEnter,
  } = useHoverDropdown();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const attachmentCount = files.length;

  const select = (kind: ComposerKind, source: ComposerSourceKind) => {
    onSelectKind(kind, source);
    setOpen(false);
    setMobileMenuOpen(false);
  };

  const handlePlusClick = () => {
    if (isMobile) {
      setMobileMenuOpen(true);
      return;
    }
    setOpen(true);
  };

  return (
    <div
      ref={wrapperRef}
      className={`relative shrink-0 ${className ?? ""}`}
      onMouseEnter={isMobile ? undefined : onWrapperMouseEnter}
      onMouseLeave={isMobile ? undefined : onWrapperMouseLeave}
    >
      {/* Clip container grows leftward — input (flex-1) shrinks in sync.
          Обрезка нужна только по горизонтали, но overflow-hidden режет и
          сверху: зона нажатия кнопки внутри срезалась до 37px. Паддинг
          с равным отрицательным полем растит область обрезки, не двигая
          строку. */}
      <m.div
        className="-mx-1 -my-1 flex shrink-0 justify-end overflow-hidden px-1 py-1"
        initial={false}
        // Ширина анимируется по border-box, а паддинг ниже — часть зоны
        // нажатия, не содержимого: без этих 8 внутренняя строка обрезалась бы.
        animate={{ width: (showSend ? ACTIONS_WIDTH_EXPANDED : BTN_SIZE) + TAP_PAD * 2 }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="flex shrink-0 items-center gap-[8px]"
          style={{ width: sendable ? ACTIONS_WIDTH_EXPANDED : BTN_SIZE }}
        >
          {sendable && (
            <m.button
              type="button"
              aria-label={t("components.createPostMenu.sendAria")}
              onPointerDown={(e) => e.preventDefault()}
              onClick={(e) => {
                e.stopPropagation();
                onSend();
              }}
              disabled={!showSend}
              initial={false}
              animate={{
                opacity: showSend ? 1 : 0,
                scale: showSend ? 1 : 0.72,
              }}
              transition={{ duration: 0.2, ease: [0.22, 1, 0.36, 1] }}
              className={cn(
                TAP_TARGET_44,
                "grid h-[36px] w-[36px] shrink-0 cursor-pointer place-items-center rounded-full transition-opacity hover:opacity-90 disabled:pointer-events-none",
              )}
              style={{
                background: "var(--accent)",
                color: "var(--accent-foreground)",
                pointerEvents: showSend ? "auto" : "none",
              }}
            >
              <Send size={17} className="-translate-x-px translate-y-px" />
            </m.button>
          )}

          <button
            type="button"
            aria-label={
              isMobile
                ? t("components.createPostMenu.createAria")
                : t("components.createPostMenu.addMediaAria")
            }
            onClick={handlePlusClick}
            className={cn(
              TAP_TARGET_44,
              "relative grid h-[36px] w-[36px] shrink-0 cursor-pointer place-items-center rounded-full transition-opacity hover:opacity-90",
            )}
            style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
          >
            <Plus size={18} />
            {attachmentCount > 0 && (
              <span
                className="absolute -right-0.5 -top-0.5 grid min-h-[16px] min-w-[16px] place-items-center rounded-full px-[4px] text-[10px] font-bold leading-none"
                style={{ background: "var(--accent)", color: "#fff" }}
              >
                {attachmentCount}
              </span>
            )}
          </button>
        </div>
      </m.div>

      {/* Outside overflow-hidden so the hover panel is not clipped */}
      {!isMobile && open && (
        <KindPickerMenu
          onSelect={select}
          /*
            Раскрывается влево от правого края композера и никуда не выходит:
            подменю, которое уезжало вправо на панель направлений, больше нет,
            а `max-w` держит блок внутри центральной колонки на любой ширине.
          */
          className="absolute right-0 top-[calc(100%+8px)] z-[var(--z-modal)] w-[12rem] max-w-[calc(100vw-32px)] overflow-visible rounded-[var(--r-card-sm)] border p-1 shadow-md"
          style={{
            background: "var(--background-elevated)",
            borderColor: "var(--border)",
            color: "var(--foreground)",
          }}
          onMouseEnter={onContentMouseEnter}
          onMouseLeave={onWrapperMouseLeave}
        />
      )}

      {isMobile && (
        <Drawer
          open={mobileMenuOpen}
          onOpenChange={setMobileMenuOpen}
          shouldScaleBackground={false}
        >
          <DrawerContent className="pb-[calc(var(--safe-bottom)+12px)]">
            <div className="px-4 pt-3">
              <DrawerTitle className="text-base">
                {t("components.createPostMenu.createTitle")}
              </DrawerTitle>
            </div>
            <div className="mt-2 px-2 pb-1">
              <KindPickerMenu onSelect={select} flat className="flex flex-col px-2" />
            </div>
          </DrawerContent>
        </Drawer>
      )}
    </div>
  );
}

/**
 * Строка создания записи — 56 px: аватар, приглашение и ⊕.
 *
 * До 05.09 здесь стояла карточка высотой 64 px с одной кнопкой «Создать» по
 * центру: она занимала место первого экрана, но не говорила, от чьего имени
 * пишут и что вообще произойдёт. Строка отвечает на оба вопроса и заодно
 * отдаёт первому экрану восемь пикселей.
 *
 * Само поле ввода здесь не живёт: нажатие открывает модальный композер — тот
 * же, что открывается из ⊕ и из пустого состояния ленты. Второго редактора
 * в проекте не заводим.
 *
 * Экспортирована, потому что стена сообщества и канала просит ровно такую же
 * строку. Набирать её там заново значило бы завести вторую с теми же
 * размерами и тем же плейсхолдером; страница вместо этого передаёт свои
 * обработчики — у неё своё окно создания записи.
 */
export function CreatePostRow({
  me,
  onSelectKind,
}: {
  me: User;
  onSelectKind: (kind: ComposerKind, source: ComposerSourceKind) => void;
}) {
  const { t } = useTranslation();
  const isMobile = useIsMobile();

  return (
    <div
      className="flex h-[56px] w-full items-center gap-[10px] rounded-[var(--r-card)] border px-[12px]"
      style={{
        background: "var(--background-elevated)",
        borderColor: "var(--border)",
        boxShadow: "var(--shadow-card)",
      }}
    >
      <UserAvatar src={me.avatar} name={me.name} size={40} />
      {/* Коробка 44 — палец; пилюля внутри 36 — глаз. Псевдоэлементом здесь
          не обойтись: truncate ставит на кнопку overflow-hidden, который
          обрезает и её собственный ::after. */}
      <button
        type="button"
        onClick={() => onSelectKind("photo", "profile")}
        className="flex h-11 min-w-0 flex-1 items-center"
      >
        <span
          className="h-9 w-full truncate rounded-[var(--r-pill)] px-[14px] text-left text-[14px] leading-9 transition-colors hover:opacity-90"
          style={{ background: "var(--background-surface)", color: "var(--foreground-50)" }}
        >
          {t("components.createPostMenu.placeholder")}
        </span>
      </button>
      <ComposerActions
        text=""
        files={[]}
        onSend={() => onSelectKind("photo", "profile")}
        onSelectKind={onSelectKind}
        isMobile={isMobile}
        sendable={false}
      />
    </div>
  );
}

export function CreatePostMenu({ me, onCompose }: Props) {
  const { guardAction } = useGuestAccess();

  /*
   * Источник всегда «профиль»: «плюс» в ленте заводит запись на своей стене,
   * как во ВКонтакте. Запись от имени канала делается на странице канала —
   * там свой композер и своя форма, с другими полями и другим запросом.
   */
  const handleSelectKind = (kind: ComposerKind, source: ComposerSourceKind) => {
    guardAction("feed.compose.open", () => onCompose({ kind, source }, { text: "", files: [] }));
  };

  return <CreatePostRow me={me} onSelectKind={handleSelectKind} />;
}
