import { useState } from "react";
import { ChevronDown, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubTrigger,
  DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Drawer, DrawerContent, DrawerTrigger, DrawerTitle } from "@/components/ui/drawer";
import { useHoverDropdown } from "@/lib/hooks/useHoverDropdown";
import { useChannels, type Channel } from "@/lib/channels";

export type ComposerKind = "photo" | "video";
export type ComposerSourceKind = "profile" | "channel";

export interface ComposerSelection {
  kind: ComposerKind;
  source: ComposerSourceKind;
  /** Present iff source === "channel". */
  channel?: Channel;
}

interface Props {
  onSelect: (selection: ComposerSelection) => void;
}

const KIND_LABEL: Record<ComposerKind, string> = { photo: "Пост", video: "Видео" };

const ROW_CLASS =
  "flex min-h-[52px] items-center rounded-[var(--r-card-sm)] px-3 text-left text-[15px] font-medium transition-colors hover:bg-[var(--background-surface)]";

/** Replaces the old always-open "Что нового?" composer row with a single
 *  minimal "Создать" trigger. Desktop reveals a hover/click dropdown
 *  (type, then — only for a channel owner — source, via a native Radix
 *  submenu); mobile uses a flat vaul bottom sheet instead, since 2-4 items
 *  don't need a second sheet screen. */
export function CreatePostMenu({ onSelect }: Props) {
  const { channels } = useChannels();
  const myChannel = channels.find((c) => c.isOwner);
  const { open, setOpen, wrapperRef, onWrapperMouseEnter, onWrapperMouseLeave, onContentMouseEnter } = useHoverDropdown();
  const [mobileOpen, setMobileOpen] = useState(false);

  const select = (kind: ComposerKind, source: ComposerSourceKind) => {
    onSelect({ kind, source, channel: source === "channel" ? myChannel : undefined });
    setOpen(false);
    setMobileOpen(false);
  };

  const triggerButton = (
    <button
      type="button"
      className="inline-flex h-[40px] items-center gap-[6px] rounded-[var(--r-button)] border px-[16px] text-[14px] font-semibold transition-colors hover:bg-[var(--background-surface-hover)]"
      style={{ borderColor: "var(--border)", color: "var(--foreground)", background: "var(--background-surface)" }}
    >
      <Plus size={16} /> Создать
    </button>
  );

  // Mobile gets the same full-width block treatment as the "Найди своих" row
  // right below it, instead of a small pill floating on its own — matches
  // that row's icon-circle + title/subtitle + chevron layout.
  const mobileTriggerButton = (
    <button
      type="button"
      className="flex w-full items-center gap-[12px] rounded-[var(--r-card)] border px-[14px] py-[12px] text-left transition-colors hover:bg-[var(--background-surface)]"
      style={{ background: "var(--background-elevated)", borderColor: "var(--border)" }}
    >
      <span
        className="grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[10px]"
        style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
      >
        <Plus className="h-[18px] w-[18px]" />
      </span>
      <span className="min-w-0 flex-1">
        <span
          className="block text-[14px] font-semibold"
          style={{ fontFamily: "var(--font-display)", color: "var(--foreground)" }}
        >
          Создать
        </span>
        <span className="block text-[12px]" style={{ color: "var(--foreground-50)" }}>
          Пост или видео{myChannel ? " — от профиля или канала" : ""}
        </span>
      </span>
      <ChevronDown className="h-[16px] w-[16px] -rotate-90 shrink-0" style={{ color: "var(--foreground-50)" }} />
    </button>
  );

  return (
    <>
      {/* Desktop */}
      <div
        ref={wrapperRef}
        className="relative hidden lg:block"
        onMouseEnter={onWrapperMouseEnter}
        onMouseLeave={onWrapperMouseLeave}
      >
        <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
          <DropdownMenuTrigger asChild>{triggerButton}</DropdownMenuTrigger>
          <DropdownMenuContent
            portalContainer={wrapperRef.current}
            align="start"
            sideOffset={8}
            onMouseEnter={onContentMouseEnter}
            onMouseLeave={onWrapperMouseLeave}
          >
            {(["photo", "video"] as const).map((kind) =>
              myChannel ? (
                <DropdownMenuSub key={kind}>
                  <DropdownMenuSubTrigger>{KIND_LABEL[kind]}</DropdownMenuSubTrigger>
                  <DropdownMenuSubContent>
                    <DropdownMenuItem onSelect={() => select(kind, "profile")}>От своего профиля</DropdownMenuItem>
                    <DropdownMenuItem onSelect={() => select(kind, "channel")}>От канала «{myChannel.name}»</DropdownMenuItem>
                  </DropdownMenuSubContent>
                </DropdownMenuSub>
              ) : (
                <DropdownMenuItem key={kind} onSelect={() => select(kind, "profile")}>
                  {KIND_LABEL[kind]}
                </DropdownMenuItem>
              ),
            )}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Mobile */}
      <div className="lg:hidden">
        <Drawer open={mobileOpen} onOpenChange={setMobileOpen} shouldScaleBackground={false}>
          <DrawerTrigger asChild>{mobileTriggerButton}</DrawerTrigger>
          <DrawerContent className="pb-[calc(var(--safe-bottom)+12px)]">
            <div className="px-4 pt-3">
              <DrawerTitle className="text-base">Создать</DrawerTitle>
            </div>
            <div className="mt-2 flex flex-col px-2 pb-1">
              {myChannel ? (
                <>
                  <button type="button" onClick={() => select("photo", "profile")} className={ROW_CLASS} style={{ color: "var(--foreground)" }}>
                    Пост от профиля
                  </button>
                  <button type="button" onClick={() => select("photo", "channel")} className={ROW_CLASS} style={{ color: "var(--foreground)" }}>
                    Пост от канала «{myChannel.name}»
                  </button>
                  <button type="button" onClick={() => select("video", "profile")} className={ROW_CLASS} style={{ color: "var(--foreground)" }}>
                    Видео от профиля
                  </button>
                  <button type="button" onClick={() => select("video", "channel")} className={ROW_CLASS} style={{ color: "var(--foreground)" }}>
                    Видео от канала «{myChannel.name}»
                  </button>
                </>
              ) : (
                <>
                  <button type="button" onClick={() => select("photo", "profile")} className={ROW_CLASS} style={{ color: "var(--foreground)" }}>
                    Пост
                  </button>
                  <button type="button" onClick={() => select("video", "profile")} className={ROW_CLASS} style={{ color: "var(--foreground)" }}>
                    Видео
                  </button>
                </>
              )}
            </div>
          </DrawerContent>
        </Drawer>
      </div>
    </>
  );
}
