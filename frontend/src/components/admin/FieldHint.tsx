import type { ReactNode } from "react";
import { CircleHelp } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

/**
 * Знак «?» у подписи поля: при наведении объясняет, что поле делает.
 *
 * ПОЧЕМУ НЕ `title`. Системная подсказка появляется через секунду с
 * лишним, не читается с клавиатуры в части браузеров и не переносит
 * строки. Здесь текст на две-три строки, и его должно быть видно сразу.
 *
 * ПОЧЕМУ `preventDefault` НА КЛИКЕ. Подписи полей в админке — это
 * `<label>`, обёрнутый вокруг поля ввода. Клик по чему угодно внутри
 * ярлыка браузер переадресует полю: нажатие на «?» ставило бы курсор в
 * соседний ввод, а у флажка — переключало бы его. Подсказка открывается
 * наведением и фокусом, клик ей не нужен вовсе.
 *
 * `aria-label` обязателен: внутри кнопки только значок, и без имени
 * диктор прочитает «кнопка». Текст подсказки при этом остаётся
 * содержимым всплывающего окна — Radix связывает их сам.
 */
export function FieldHint({ label, children }: { label: string; children: ReactNode }) {
  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            onClick={(e) => e.preventDefault()}
            aria-label={label}
            className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full align-middle"
            style={{ color: "var(--foreground-50)" }}
          >
            <CircleHelp size={14} />
          </button>
        </TooltipTrigger>
        <TooltipContent className="max-w-[280px] text-[12px] leading-snug">
          {children}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
