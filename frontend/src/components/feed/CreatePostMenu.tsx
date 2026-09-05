import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { ChevronDown, Plus, Send } from "lucide-react";
import { motion } from "framer-motion";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { UserAvatar } from "@/components/ui/UserAvatar";
import { useIsMobile } from "@/hooks/use-mobile";
import { useHoverDropdown } from "@/lib/hooks/useHoverDropdown";
import { useChannels, type Channel } from "@/lib/channels";
import { useGuestAccess } from "@/components/access/GuestAccessProvider";
import type { User } from "@/lib/mock";

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

function inferKind(files: File[]): ComposerKind {
  return files.some((f) => f.type.startsWith("video/")) ? "video" : "photo";
}

const BTN_SIZE = 36;
const ACTION_GAP = 8;
const ACTIONS_WIDTH_EXPANDED = BTN_SIZE * 2 + ACTION_GAP;

function KindPickerMenu({
  myChannel,
  onSelect,
  onAddFile,
  className,
  style,
  onMouseEnter,
  onMouseLeave,
  flat = false,
}: {
  myChannel?: Channel;
  onSelect: (kind: ComposerKind, source: ComposerSourceKind) => void;
  onAddFile?: () => void;
  className?: string;
  style?: React.CSSProperties;
  onMouseEnter?: (e: React.MouseEvent) => void;
  onMouseLeave?: (e: React.MouseEvent) => void;
  /** Flat list for mobile sheet (no hover submenus). */
  flat?: boolean;
}) {
  const { t } = useTranslation();
  const kindLabel = (kind: ComposerKind) =>
    kind === "video" ? t("components.createPostMenu.video") : t("components.createPostMenu.post");
  const select = (kind: ComposerKind, source: ComposerSourceKind) => {
    onSelect(kind, source);
  };

  if (flat) {
    return (
      <div role="menu" className={className} style={style}>
        {onAddFile && (
          <button
            type="button"
            className={ROW_CLASS}
            style={{ color: "var(--foreground)" }}
            onClick={onAddFile}
          >
            {t("components.createPostMenu.fromDevice")}
          </button>
        )}
        {myChannel ? (
          <>
            <button
              type="button"
              className={ROW_CLASS}
              style={{ color: "var(--foreground)" }}
              onClick={() => select("photo", "profile")}
            >
              {t("components.createPostMenu.postFromProfile")}
            </button>
            <button
              type="button"
              className={ROW_CLASS}
              style={{ color: "var(--foreground)" }}
              onClick={() => select("photo", "channel")}
            >
              {t("components.createPostMenu.postFromChannel", { name: myChannel.name })}
            </button>
            <button
              type="button"
              className={ROW_CLASS}
              style={{ color: "var(--foreground)" }}
              onClick={() => select("video", "profile")}
            >
              {t("components.createPostMenu.videoFromProfile")}
            </button>
            <button
              type="button"
              className={ROW_CLASS}
              style={{ color: "var(--foreground)" }}
              onClick={() => select("video", "channel")}
            >
              {t("components.createPostMenu.videoFromChannel", { name: myChannel.name })}
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={ROW_CLASS}
              style={{ color: "var(--foreground)" }}
              onClick={() => select("photo", "profile")}
            >
              {t("components.createPostMenu.post")}
            </button>
            <button
              type="button"
              className={ROW_CLASS}
              style={{ color: "var(--foreground)" }}
              onClick={() => select("video", "profile")}
            >
              {t("components.createPostMenu.video")}
            </button>
          </>
        )}
      </div>
    );
  }

  return (
    <div
      role="menu"
      className={className}
      style={style}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
    >
      {onAddFile && (
        <button type="button" className={MENU_ITEM_CLASS} onClick={onAddFile}>
          {t("components.createPostMenu.fromDevice")}
        </button>
      )}
      {(["photo", "video"] as const).map((kind) =>
        myChannel ? (
          <div key={kind} className="group/sub relative">
            <button type="button" className={`${MENU_ITEM_CLASS} justify-between`}>
              {kindLabel(kind)}
              <ChevronDown size={14} className="-rotate-90 opacity-60" />
            </button>
            <div
              className="absolute left-full top-0 z-10 ml-1 hidden min-w-[12rem] flex-col rounded-[var(--r-card-sm)] border p-1 shadow-md group-hover/sub:flex"
              style={{
                background: "var(--background-elevated)",
                borderColor: "var(--border)",
              }}
            >
              <button
                type="button"
                className={MENU_ITEM_CLASS}
                onClick={() => select(kind, "profile")}
              >
                {t("components.createPostMenu.fromProfile")}
              </button>
              <button
                type="button"
                className={MENU_ITEM_CLASS}
                onClick={() => select(kind, "channel")}
              >
                {t("components.createPostMenu.fromChannel", { name: myChannel.name })}
              </button>
            </div>
          </div>
        ) : (
          <button
            key={kind}
            type="button"
            className={MENU_ITEM_CLASS}
            onClick={() => select(kind, "profile")}
          >
            {kindLabel(kind)}
          </button>
        ),
      )}
    </div>
  );
}

function ComposerActions({
  text,
  files,
  onSend,
  onPickFiles,
  onSelectKind,
  myChannel,
  isMobile = false,
  className,
  sendable = true,
}: {
  text: string;
  files: File[];
  onSend: () => void;
  onPickFiles: (files: File[]) => void;
  onSelectKind: (kind: ComposerKind, source: ComposerSourceKind) => void;
  myChannel?: Channel;
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
  const fileRef = useRef<HTMLInputElement>(null);
  const attachmentCount = files.length;

  const select = (kind: ComposerKind, source: ComposerSourceKind) => {
    onSelectKind(kind, source);
    setOpen(false);
    setMobileMenuOpen(false);
  };

  const openFilePicker = () => {
    fileRef.current?.click();
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
      <input
        ref={fileRef}
        type="file"
        accept="image/*,video/*"
        multiple
        className="hidden"
        onChange={(e) => {
          const picked = e.target.files;
          if (picked?.length) onPickFiles(Array.from(picked));
          e.target.value = "";
        }}
      />

      {/* Clip container grows leftward — input (flex-1) shrinks in sync */}
      <motion.div
        className="flex shrink-0 justify-end overflow-hidden"
        initial={false}
        animate={{ width: showSend ? ACTIONS_WIDTH_EXPANDED : BTN_SIZE }}
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <div
          className="flex shrink-0 items-center gap-[8px]"
          style={{ width: sendable ? ACTIONS_WIDTH_EXPANDED : BTN_SIZE }}
        >
          {sendable && (
            <motion.button
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
              className="grid h-[36px] w-[36px] shrink-0 cursor-pointer place-items-center rounded-full transition-opacity hover:opacity-90 disabled:pointer-events-none"
              style={{
                background: "var(--accent)",
                color: "var(--accent-foreground)",
                pointerEvents: showSend ? "auto" : "none",
              }}
            >
              <Send size={17} className="-translate-x-px translate-y-px" />
            </motion.button>
          )}

          <button
            type="button"
            aria-label={
              isMobile
                ? t("components.createPostMenu.createAria")
                : t("components.createPostMenu.addMediaAria")
            }
            onClick={handlePlusClick}
            className="relative grid h-[36px] w-[36px] shrink-0 cursor-pointer place-items-center rounded-full transition-opacity hover:opacity-90"
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
      </motion.div>

      {/* Outside overflow-hidden so the hover panel is not clipped */}
      {!isMobile && open && (
        <KindPickerMenu
          myChannel={myChannel}
          onSelect={select}
          onAddFile={openFilePicker}
          className="absolute right-0 top-[calc(100%+8px)] z-[var(--z-modal)] min-w-[10rem] overflow-visible rounded-[var(--r-card-sm)] border p-1 shadow-md"
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
              <KindPickerMenu
                myChannel={myChannel}
                onSelect={select}
                onAddFile={openFilePicker}
                flat
                className="flex flex-col px-2"
              />
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
 */
function CreatePostRow({
  me,
  myChannel,
  onSelectKind,
  onCompose,
}: {
  me: User;
  myChannel?: Channel;
  onSelectKind: (kind: ComposerKind, source: ComposerSourceKind) => void;
  onCompose: (selection: ComposerSelection, draft: ComposerDraft) => void;
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
      <UserAvatar src={me.avatar} name={me.name} size={36} />
      <button
        type="button"
        onClick={() => onSelectKind("photo", "profile")}
        className="h-[36px] min-w-0 flex-1 truncate rounded-[var(--r-pill)] px-[14px] text-left text-[14px] transition-colors hover:opacity-90"
        style={{ background: "var(--background-surface)", color: "var(--foreground-50)" }}
      >
        {t("components.createPostMenu.placeholder")}
      </button>
      <ComposerActions
        text=""
        files={[]}
        onSend={() => onSelectKind("photo", "profile")}
        onPickFiles={(picked) =>
          onCompose({ kind: inferKind(picked), source: "profile" }, { text: "", files: picked })
        }
        onSelectKind={onSelectKind}
        myChannel={myChannel}
        isMobile={isMobile}
        sendable={false}
      />
    </div>
  );
}

export function CreatePostMenu({ me, onCompose }: Props) {
  const { channels } = useChannels();
  const myChannel = channels.find((c) => c.isOwner);
  const { guardAction } = useGuestAccess();

  const compose = (selection: ComposerSelection, draft: ComposerDraft) => {
    guardAction("feed.compose.open", () => onCompose(selection, draft));
  };

  const handleSelectKind = (kind: ComposerKind, source: ComposerSourceKind) => {
    compose(
      { kind, source, channel: source === "channel" ? myChannel : undefined },
      { text: "", files: [] },
    );
  };

  return (
    <CreatePostRow
      me={me}
      myChannel={myChannel}
      onSelectKind={handleSelectKind}
      onCompose={(selection, draft) => compose(selection, draft)}
    />
  );
}
