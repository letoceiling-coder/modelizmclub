import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  icon?: ReactNode;
  children: ReactNode;
}

/** One window: a centered dialog on desktop, a bottom sheet under 768px. */
export function GateDialogShell({ open, onOpenChange, title, description, icon, children }: Props) {
  const mobile = useIsMobile();

  const header = (
    <>
      {icon && (
        <div
          className="mb-2 grid h-12 w-12 place-items-center rounded-full"
          style={{ background: "var(--accent-soft)", color: "var(--accent)" }}
        >
          {icon}
        </div>
      )}
    </>
  );

  if (mobile) {
    return (
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent
          side="bottom"
          className="rounded-t-[var(--r-modal)] px-4 pb-[max(16px,env(safe-area-inset-bottom))] pt-5"
        >
          <SheetHeader className="text-left">
            {header}
            <SheetTitle>{title}</SheetTitle>
            {description && <SheetDescription>{description}</SheetDescription>}
          </SheetHeader>
          <div className="mt-4">{children}</div>
        </SheetContent>
      </Sheet>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[420px]">
        <DialogHeader>
          {header}
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="mt-2">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
