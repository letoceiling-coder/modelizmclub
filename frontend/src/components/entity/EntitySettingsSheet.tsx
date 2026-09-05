import type { ReactNode } from "react";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  /** Панель настроек: своя у сообщества, своя у канала. */
  children: ReactNode;
}

/**
 * Шторка настроек сущности.
 *
 * Отличались только заголовок, описание и то, какую панель класть внутрь.
 * Панель приходит children — оболочке незачем знать, чем её наполнили.
 */
export function EntitySettingsSheet({ open, onOpenChange, title, description, children }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>{title}</SheetTitle>
          <SheetDescription>{description}</SheetDescription>
        </SheetHeader>
        <div className="mt-6 pb-8">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
