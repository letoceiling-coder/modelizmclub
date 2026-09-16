import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { cn } from "@/lib/utils";

/**
 * Явный конец внутреннего списка.
 *
 * Разбор 16.09: в списках мессенджера прокрутка просто упиралась — не было
 * видно, что диалогов больше нет, а не что следующие не догрузились. На
 * страницах с подвалом сайта конец и так виден; эта строка — для списков в
 * своей прокрутке, где подвала нет и быть не может.
 *
 * Ставить только под полностью загруженным списком. Если загружена часть —
 * передать свой текст («Показаны последние 100»), а не обещать «Это все».
 */
export function ListEnd({ children, className }: { children?: ReactNode; className?: string }) {
  const { t } = useTranslation();
  return (
    <p
      data-list-end=""
      className={cn("px-[16px] py-[16px] text-center text-[12px]", className)}
      style={{ color: "var(--foreground-50)" }}
    >
      {children ?? t("common.listEnd")}
    </p>
  );
}
