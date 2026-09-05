import { useTranslation } from "react-i18next";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Заголовок статистики: «Оценили N человек», просмотры — только достоверные. */
  stats?: string;
  /** Превью медиа поста: на десктопе даёт контекст, о чём ветка. */
  preview?: ReactNode;
  children: ReactNode;
}

/**
 * Комментарии отдельным слоем: шторка снизу на мобильном, окно по центру на
 * десктопе.
 *
 * До 05.09 ветка жила прямо в карточке ленты, и пост с девятью комментариями
 * растягивался на несколько экранов: чтобы дойти до следующего поста, надо было
 * пролистать всю переписку и поле ввода. Лента перестаёт быть потоком постов,
 * как только в неё встраивают переписку.
 *
 * Содержимое сюда передаётся снаружи — это тот же CommentSection, что был в
 * карточке, со списком, ответами, лайками, вложениями и композером. Здесь
 * только оболочка: заголовок, статистика и закрытие.
 */
export function CommentsSheet({ open, onOpenChange, stats, preview, children }: Props) {
  const { t } = useTranslation();
  const mobile = useIsMobile();

  const header = (
    <div className="flex items-center gap-[8px] px-[16px] pb-[8px]">
      {preview}
      <div className="min-w-0 flex-1">
        <div className="truncate text-[20px] font-semibold" style={{ color: "var(--foreground)" }}>
          {t("components.commentsSheet.title")}
        </div>
        {stats && (
          <div className="truncate text-[13px]" style={{ color: "var(--foreground-50)" }}>
            {stats}
          </div>
        )}
      </div>
      <button
        type="button"
        onClick={() => onOpenChange(false)}
        aria-label={t("common.close")}
        className="hit-target grid h-[32px] w-[32px] shrink-0 place-items-center rounded-full"
        style={{ color: "var(--foreground-70)" }}
      >
        <X size={20} />
      </button>
    </div>
  );

  if (mobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {/* 85% высоты: список остаётся списком, а лента за ним видна полосой и
            подсказывает, что это слой поверх, а не новая страница. */}
        <DrawerContent className="h-[85dvh] rounded-t-[16px]">
          <div className="flex h-full min-h-0 flex-col pt-[8px]">
            {header}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">{children}</div>
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] w-[720px] max-w-[calc(100vw-32px)] flex-col gap-0 p-0 pt-[16px]">
        {header}
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </DialogContent>
    </Dialog>
  );
}
