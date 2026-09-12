import type React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

/**
 * Стрелка листания поверх изображения.
 *
 * ПОЧЕМУ ОДНА НА ВСЕХ. Стрелки жили в пяти местах и выглядели по-разному:
 * в просмотрщике — белая подложка 14 % под белым значком, в галерее
 * объявления — светлый круг `--background-elevated` с тёмным значком, в лентах
 * — тёмная 40 %. Первые две на светлой фотографии исчезали: подложка и снимок
 * одного тона. Белые 14 % поверх белого кадра дают ровно тот же белый —
 * отношение 1,00 : 1 при требуемых 3 : 1 для нетекстовых элементов
 * (WCAG 1.4.11). Светлый круг галереи на белом — того же порядка.
 *
 * ПРАВИЛО, как в просмотрщиках ВКонтакте, Авито и Google Photos: подложка не
 * зависит от того, что под ней. Тёмный полупрозрачный круг и белая стрелка
 * читаются и на белом, и на чёрном, и на пёстром.
 *
 * ПОЧЕМУ 50 %, А НЕ 40 %. Считаем по яркости: чёрный на 40 % поверх белого
 * кадра даёт серый 153, его относительная яркость 0,319, отношение к белому
 * значку — 2,85 : 1. Это ниже порога 3 : 1, который WCAG 1.4.11 требует для
 * нетекстовых элементов. На 50 % получается серый 128, яркость 0,216 и
 * отношение 3,95 : 1 — с запасом. На чёрном кадре подложка сливается с фоном,
 * но белый значок даёт там 21 : 1, и тень отделяет круг от снимка.
 *
 * РАЗМЕРЫ. Круг 40×40 — видимый; зону нажатия до 44 добирает `hit-target`
 * псевдоэлементом, не меняя вида. При наведении подложка плотнее — 70 %.
 *
 * Позиционирование остаётся за местом применения: у просмотрщика отступ 12,
 * у ленты 8, и это разные решения, а не общий стиль.
 */
export function MediaArrow({
  direction,
  onClick,
  label,
  className = "",
  disabled = false,
  ...rest
}: {
  direction: "prev" | "next";
  /** Событие отдаём наружу: просмотрщику нужен `stopPropagation`. */
  onClick: (event: React.MouseEvent<HTMLButtonElement>) => void;
  label: string;
  /** Позиция и видимость: `absolute left-[12px] top-1/2 -translate-y-1/2` и т. п. */
  className?: string;
  disabled?: boolean;
  /* Остальное — обычные свойства кнопки: карусель событий гасит на них
     всплытие указателя, чтобы перелистывание не считалось перетаскиванием. */
} & Omit<React.ComponentPropsWithoutRef<"button">, "onClick" | "className" | "disabled">) {
  const Icon = direction === "prev" ? ChevronLeft : ChevronRight;

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      disabled={disabled}
      {...rest}
      className={`hit-target grid h-[40px] w-[40px] place-items-center rounded-full bg-black/50 text-white shadow-[0_2px_8px_rgba(0,0,0,0.35)] backdrop-blur-[6px] transition-colors hover:bg-black/70 disabled:opacity-40 ${className}`}
    >
      <Icon className="h-[20px] w-[20px]" />
    </button>
  );
}
