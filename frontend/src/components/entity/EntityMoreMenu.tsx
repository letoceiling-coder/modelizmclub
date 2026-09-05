import { useState, type ComponentType, type CSSProperties } from "react";
import { MoreHorizontal, Check } from "lucide-react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Drawer, DrawerContent, DrawerTitle } from "@/components/ui/drawer";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export interface MoreMenuItem {
  id: string;
  icon: ComponentType<{ size?: number | string; className?: string; style?: CSSProperties }>;
  label: string;
  onSelect: () => void;
  /** Красным, с подтверждением на стороне обработчика. */
  danger?: boolean;
  /** Пункт-переключатель: справа галочка, когда включено. */
  checked?: boolean;
  disabled?: boolean;
}

/**
 * «⋯ Ещё» — второстепенные действия сущности.
 *
 * Общий для сообществ и каналов: список пунктов приходит снаружи, оболочка
 * знает только про раскладку и слой. На широком экране — выпадающее меню на
 * слое popover, на ≤767 — шторка снизу: на телефоне выпадающий список в углу
 * экрана не попадает под палец.
 */
export function EntityMoreMenu({
  items,
  ariaLabel,
  title,
}: {
  items: MoreMenuItem[];
  ariaLabel: string;
  /** Заголовок шторки на мобильном. */
  title: string;
}) {
  const mobile = useIsMobile();
  const [open, setOpen] = useState(false);

  if (items.length === 0) return null;

  const run = (item: MoreMenuItem) => {
    setOpen(false);
    item.onSelect();
  };

  const trigger = (
    <button
      type="button"
      aria-label={ariaLabel}
      onClick={mobile ? () => setOpen(true) : undefined}
      className="hit-target grid h-[36px] w-[36px] shrink-0 place-items-center rounded-[var(--r-button)] border transition-colors hover:bg-[var(--background-surface)]"
      style={{ borderColor: "var(--border)", color: "var(--foreground-70)" }}
    >
      <MoreHorizontal size={18} />
    </button>
  );

  if (mobile) {
    return (
      <>
        {trigger}
        <Drawer open={open} onOpenChange={setOpen}>
          <DrawerContent className="pb-[calc(var(--safe-bottom)+12px)]">
            <div className="px-[16px] pt-[12px]">
              <DrawerTitle className="text-[17px]">{title}</DrawerTitle>
            </div>
            <div className="mt-[8px] pb-[4px]">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  disabled={item.disabled}
                  onClick={() => run(item)}
                  className="flex min-h-[48px] w-full items-center gap-[12px] px-[16px] text-left text-[15px] transition-colors hover:bg-[var(--background-surface)] disabled:opacity-45"
                  style={{
                    color: item.danger ? "var(--destructive, #e5484d)" : "var(--foreground)",
                  }}
                >
                  <item.icon
                    size={20}
                    className="shrink-0"
                    style={{
                      color: item.danger ? "var(--destructive, #e5484d)" : "var(--foreground-70)",
                    }}
                  />
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {item.checked && <Check size={18} style={{ color: "var(--accent)" }} />}
                </button>
              ))}
            </div>
          </DrawerContent>
        </Drawer>
      </>
    );
  }

  return (
    <DropdownMenu open={open} onOpenChange={setOpen} modal={false}>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        sideOffset={6}
        className="z-[var(--z-popover)] w-[260px] overflow-hidden rounded-[12px] border p-0"
        style={{
          background: "var(--background-elevated)",
          borderColor: "var(--border)",
          boxShadow: "var(--shadow-float)",
        }}
      >
        {items.map((item) => (
          <DropdownMenuItem
            key={item.id}
            disabled={item.disabled}
            onClick={() => run(item)}
            className="flex h-[40px] cursor-pointer items-center gap-[10px] rounded-none px-[14px] text-[15px] focus:bg-[var(--background-surface)]"
            style={{ color: item.danger ? "var(--destructive, #e5484d)" : "var(--foreground)" }}
          >
            <item.icon
              size={20}
              className="shrink-0"
              style={{
                color: item.danger ? "var(--destructive, #e5484d)" : "var(--foreground-70)",
              }}
            />
            <span className="min-w-0 flex-1 truncate">{item.label}</span>
            {item.checked && <Check size={16} style={{ color: "var(--accent)" }} />}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
