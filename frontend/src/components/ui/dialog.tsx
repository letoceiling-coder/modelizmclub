"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { Drawer as DrawerPrimitive } from "vaul";
import { X } from "lucide-react";

import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/use-mobile";
import { useModalBackClose } from "@/hooks/use-modal-back-close";

/**
 * Одно окно — две формы. На десктопе это центрированный Radix-диалог, на
 * ширине <768px тот же самый вызывающий код получает bottom sheet на vaul:
 * затемнение, ручка, перетаскивание пальцем и закрытие свайпом вниз.
 * Vaul построен поверх @radix-ui/react-dialog, поэтому Trigger/Close/Title/
 * Description — это буквально те же примитивы, и переключать нужно только
 * Portal/Overlay/Content.
 *
 * Аппаратная «назад» закрывает окно вместо ухода со страницы — см.
 * useModalBackClose; логика живёт здесь, чтобы её получили все окна сразу.
 */
const DialogSheetContext = React.createContext(false);

function useSheetMode(): boolean {
  return React.useContext(DialogSheetContext);
}

export interface DialogProps extends React.ComponentPropsWithoutRef<typeof DialogPrimitive.Root> {
  /**
   * `false` оставляет центрированный диалог и на мобильном — для окон,
   * которым нужна вся высота экрана (редактор фото, лайтбокс).
   */
  mobileSheet?: boolean;
}

function Dialog({
  open,
  defaultOpen,
  onOpenChange,
  modal,
  mobileSheet = true,
  children,
}: DialogProps) {
  const isMobile = useIsMobile();
  const sheet = isMobile && mobileSheet;

  // Нормализуем управление, чтобы «назад» работало и у неуправляемых окон
  // (те, что открываются через DialogTrigger без внешнего состояния).
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen ?? false);
  const isControlled = open !== undefined;
  const actualOpen = isControlled ? open : uncontrolledOpen;

  const handleOpenChange = React.useCallback(
    (next: boolean) => {
      if (!isControlled) setUncontrolledOpen(next);
      onOpenChange?.(next);
    },
    [isControlled, onOpenChange],
  );

  useModalBackClose(sheet && actualOpen, handleOpenChange);

  if (sheet) {
    return (
      <DialogSheetContext.Provider value>
        <DrawerPrimitive.Root
          open={actualOpen}
          onOpenChange={handleOpenChange}
          modal={modal}
          shouldScaleBackground={false}
          repositionInputs
        >
          {children}
        </DrawerPrimitive.Root>
      </DialogSheetContext.Provider>
    );
  }

  return (
    <DialogSheetContext.Provider value={false}>
      <DialogPrimitive.Root open={actualOpen} onOpenChange={handleOpenChange} modal={modal}>
        {children}
      </DialogPrimitive.Root>
    </DialogSheetContext.Provider>
  );
}
Dialog.displayName = "Dialog";

const DialogTrigger = DialogPrimitive.Trigger;

const DialogClose = DialogPrimitive.Close;

function DialogPortal(props: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Portal>) {
  const sheet = useSheetMode();
  return sheet ? <DrawerPrimitive.Portal {...props} /> : <DialogPrimitive.Portal {...props} />;
}
DialogPortal.displayName = "DialogPortal";

const DialogOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => {
  const sheet = useSheetMode();
  const Overlay = sheet ? DrawerPrimitive.Overlay : DialogPrimitive.Overlay;
  return (
    <Overlay
      ref={ref}
      className={cn(
        "fixed inset-0 z-50 bg-black/80",
        !sheet &&
          "data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0",
        className,
      )}
      {...props}
      onPointerDown={(e) => {
        e.stopPropagation();
        props.onPointerDown?.(e);
      }}
      onClick={(e) => {
        e.stopPropagation();
        props.onClick?.(e);
      }}
    />
  );
});
DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const closeButtonClass =
  "absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full opacity-70 ring-offset-background cursor-pointer transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground";

const DialogContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const sheet = useSheetMode();

  const stopPointer = (e: React.PointerEvent<HTMLDivElement>) => {
    e.stopPropagation();
    props.onPointerDown?.(e);
  };
  const stopClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    props.onClick?.(e);
  };

  if (sheet) {
    return (
      <DialogPortal>
        <DialogOverlay />
        <DrawerPrimitive.Content
          ref={ref}
          className={cn(
            "fixed inset-x-0 bottom-0 z-50 flex max-h-[92dvh] flex-col rounded-t-[var(--r-modal)] border bg-background outline-none",
            className,
          )}
          {...props}
          onClick={stopClick}
        >
          {/* Ручка — подсказка, что лист тянется пальцем. */}
          <div
            aria-hidden
            className="mx-auto mt-3 h-1.5 w-12 shrink-0 rounded-full"
            style={{ background: "var(--foreground-15)" }}
          />
          <div className="min-h-0 flex-1 overflow-y-auto px-4 pb-[calc(var(--safe-bottom)+16px)] pt-4">
            {children}
          </div>
          <DialogPrimitive.Close className={closeButtonClass}>
            <X className="h-4 w-4" />
            <span className="sr-only">Закрыть</span>
          </DialogPrimitive.Close>
        </DrawerPrimitive.Content>
      </DialogPortal>
    );
  }

  return (
    <DialogPortal>
      <DialogOverlay />
      <DialogPrimitive.Content
        ref={ref}
        className={cn(
          "fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg duration-200 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 sm:rounded-lg",
          className,
        )}
        {...props}
        onPointerDown={stopPointer}
        onClick={stopClick}
      >
        {children}
        <DialogPrimitive.Close className={closeButtonClass}>
          <X className="h-4 w-4" />
          <span className="sr-only">Закрыть</span>
        </DialogPrimitive.Close>
      </DialogPrimitive.Content>
    </DialogPortal>
  );
});
DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn("flex flex-col space-y-1.5 text-center sm:text-left", className)} {...props} />
);
DialogHeader.displayName = "DialogHeader";

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn("flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2", className)}
    {...props}
  />
);
DialogFooter.displayName = "DialogFooter";

const DialogTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn("text-lg font-semibold leading-none tracking-tight", className)}
    {...props}
  />
));
DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn("text-sm text-muted-foreground", className)}
    {...props}
  />
));
DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
  Dialog,
  DialogPortal,
  DialogOverlay,
  DialogTrigger,
  DialogClose,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
};
