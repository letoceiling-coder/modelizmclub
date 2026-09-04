import { useEffect, useRef, useState } from "react";
import { ChevronDown, Plus, Send, FileText, Video } from "lucide-react";
import { motion } from "framer-motion";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import { ChatAvatar } from "@/components/messenger/ChatAvatar";
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
  /** Increment after a post is successfully published to clear the inline composer. */
  draftClearToken?: number;
}

const KIND_LABEL: Record<ComposerKind, string> = { photo: "Пост", video: "Видео" };

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
            Фото или видео с устройства
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
              Пост от профиля
            </button>
            <button
              type="button"
              className={ROW_CLASS}
              style={{ color: "var(--foreground)" }}
              onClick={() => select("photo", "channel")}
            >
              Пост от канала «{myChannel.name}»
            </button>
            <button
              type="button"
              className={ROW_CLASS}
              style={{ color: "var(--foreground)" }}
              onClick={() => select("video", "profile")}
            >
              Видео от профиля
            </button>
            <button
              type="button"
              className={ROW_CLASS}
              style={{ color: "var(--foreground)" }}
              onClick={() => select("video", "channel")}
            >
              Видео от канала «{myChannel.name}»
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
              Пост
            </button>
            <button
              type="button"
              className={ROW_CLASS}
              style={{ color: "var(--foreground)" }}
              onClick={() => select("video", "profile")}
            >
              Видео
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
          Фото или видео с устройства
        </button>
      )}
      {(["photo", "video"] as const).map((kind) =>
        myChannel ? (
          <div key={kind} className="group/sub relative">
            <button type="button" className={`${MENU_ITEM_CLASS} justify-between`}>
              {KIND_LABEL[kind]}
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
                От своего профиля
              </button>
              <button
                type="button"
                className={MENU_ITEM_CLASS}
                onClick={() => select(kind, "channel")}
              >
                От канала «{myChannel.name}»
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
            {KIND_LABEL[kind]}
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
}: {
  text: string;
  files: File[];
  onSend: () => void;
  onPickFiles: (files: File[]) => void;
  onSelectKind: (kind: ComposerKind, source: ComposerSourceKind) => void;
  myChannel?: Channel;
  isMobile?: boolean;
  className?: string;
}) {
  const showSend = text.trim().length > 1;
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
          style={{ width: ACTIONS_WIDTH_EXPANDED }}
        >
          <motion.button
            type="button"
            aria-label="Отправить"
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

          <button
            type="button"
            aria-label={isMobile ? "Создать пост или видео" : "Добавить фото или видео"}
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
              <DrawerTitle className="text-base">Создать</DrawerTitle>
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

function CreatePostTrigger({
  onSelectKind,
}: {
  onSelectKind: (kind: ComposerKind, source: ComposerSourceKind) => void;
}) {
  const {
    open,
    setOpen,
    wrapperRef,
    onWrapperMouseEnter,
    onWrapperMouseLeave,
    onContentMouseEnter,
  } = useHoverDropdown();
  const [clickedOpen, setClickedOpen] = useState(false);
  const menuOpen = open || clickedOpen;

  useEffect(() => {
    if (!clickedOpen) return;
    const onDoc = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setClickedOpen(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [clickedOpen, wrapperRef]);

  const select = (kind: ComposerKind) => {
    onSelectKind(kind, "profile");
    setOpen(false);
    setClickedOpen(false);
  };

  const items: { kind: ComposerKind; label: string; icon: typeof FileText }[] = [
    { kind: "photo", label: "Пост", icon: FileText },
    { kind: "video", label: "Видео", icon: Video },
  ];

  return (
    <div
      ref={wrapperRef}
      className="relative w-full"
      onMouseEnter={onWrapperMouseEnter}
      onMouseLeave={onWrapperMouseLeave}
    >
      <div
        className="flex w-full items-center justify-center rounded-[var(--r-card)] border px-[14px] py-[14px]"
        style={{
          background: "var(--background-elevated)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-card)",
        }}
      >
        <button
          type="button"
          onClick={() => setClickedOpen((v) => !v)}
          className="inline-flex items-center gap-[8px] rounded-[var(--r-pill)] px-[4px] py-[2px] text-[16px] font-semibold transition-opacity hover:opacity-80"
          style={{ color: "var(--accent)" }}
          aria-expanded={menuOpen}
          aria-haspopup="menu"
        >
          <Plus size={20} strokeWidth={2.5} />
          Создать
          <ChevronDown
            size={18}
            className="opacity-80 transition-transform duration-200"
            style={{ transform: menuOpen ? "rotate(180deg)" : undefined }}
          />
        </button>
      </div>

      {menuOpen && (
        <div
          role="menu"
          className="absolute left-1/2 top-[calc(100%+8px)] z-[var(--z-modal)] w-[min(100%,300px)] -translate-x-1/2 overflow-hidden rounded-[var(--r-card)] border py-[6px]"
          style={{
            background: "var(--background-elevated)",
            borderColor: "var(--border)",
            boxShadow: "var(--shadow-float)",
          }}
          onMouseEnter={onContentMouseEnter}
          onMouseLeave={onWrapperMouseLeave}
        >
          {items.map(({ kind, label, icon: Icon }) => (
            <button
              key={kind}
              type="button"
              role="menuitem"
              onClick={() => select(kind)}
              className="flex w-full items-center gap-[12px] px-[16px] py-[12px] text-left text-[15px] font-medium transition-colors hover:bg-[var(--background-surface)]"
              style={{ color: "var(--foreground)" }}
            >
              <Icon className="h-[20px] w-[20px]" style={{ color: "var(--foreground-70)" }} />
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/*
function InlineComposerBar({
  me,
  draftText,
  draftFiles,
  onDraftTextChange,
  onAddFiles,
  onSend,
  onSelectKind,
  myChannel,
  isMobile = false,
}: {
  me: User;
  draftText: string;
  draftFiles: File[];
  onDraftTextChange: (v: string) => void;
  onAddFiles: (files: File[]) => void;
  onSend: () => void;
  onSelectKind: (kind: ComposerKind, source: ComposerSourceKind) => void;
  myChannel?: Channel;
  isMobile?: boolean;
}) {
  return (
    <div
      className="flex w-full items-center gap-[12px] rounded-[var(--r-card)] border px-[14px] py-[10px]"
      style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
    >
      <ChatAvatar src={me.avatar} name={me.name} size={40} />
      <motion.div
        layout
        className="min-w-0 flex-1"
        transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
      >
        <input
          type="text"
          value={draftText}
          onChange={(e) => onDraftTextChange(e.target.value)}
          placeholder="Что у вас нового?"
          className="w-full truncate rounded-[var(--r-pill)] border-0 bg-transparent px-[16px] py-[10px] text-[14px] outline-none ring-0 placeholder:text-[var(--foreground-50)] focus:ring-0"
          style={{
            background: "var(--background-surface)",
            color: "var(--foreground)",
          }}
        />
      </motion.div>
      <ComposerActions
        text={draftText}
        files={draftFiles}
        onSend={onSend}
        onPickFiles={(picked) => onAddFiles(picked)}
        onSelectKind={onSelectKind}
        myChannel={myChannel}
        isMobile={isMobile}
      />
    </div>
  );
}
*/

export function CreatePostMenu({ me, onCompose, draftClearToken = 0 }: Props) {
  const { channels } = useChannels();
  const myChannel = channels.find((c) => c.isOwner);
  const { guardAction } = useGuestAccess();

  const compose = (selection: ComposerSelection) => {
    guardAction("feed.compose.open", () => onCompose(selection, { text: "", files: [] }));
  };

  const handleSelectKind = (kind: ComposerKind, source: ComposerSourceKind) => {
    compose({ kind, source, channel: source === "channel" ? myChannel : undefined });
  };

  return <CreatePostTrigger onSelectKind={handleSelectKind} />;

  /*
  const [draftText, setDraftText] = useState("");
  const [draftFiles, setDraftFiles] = useState<File[]>([]);

  useEffect(() => {
    if (draftClearToken > 0) {
      setDraftText("");
      setDraftFiles([]);
    }
  }, [draftClearToken]);

  const buildDraft = (): ComposerDraft => ({ text: draftText.trim(), files: draftFiles });

  const handleSend = () => {
    if (draftText.trim().length <= 1) return;
    compose({ kind: inferKind(draftFiles), source: "profile" });
  };

  const addFiles = (picked: File[]) => {
    setDraftFiles((prev) => [...prev, ...picked]);
  };

  return (
    <>
      <div className="hidden lg:block">
        <InlineComposerBar
          me={me}
          draftText={draftText}
          draftFiles={draftFiles}
          onDraftTextChange={setDraftText}
          onAddFiles={addFiles}
          onSend={handleSend}
          onSelectKind={handleSelectKind}
          myChannel={myChannel}
        />
      </div>

      <div className="lg:hidden">
        <InlineComposerBar
          me={me}
          draftText={draftText}
          draftFiles={draftFiles}
          onDraftTextChange={setDraftText}
          onAddFiles={addFiles}
          onSend={handleSend}
          onSelectKind={handleSelectKind}
          myChannel={myChannel}
          isMobile
        />
      </div>
    </>
  );
  */
}
