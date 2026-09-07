/**
 * Хит-зоны мессенджера. Иконки в шапке и композере нарисованы мельче 44px, но
 * попадать по ним пальцем надо с первого раза: псевдоэлемент растягивает
 * область нажатия, не трогая визуал.
 *
 * TAP_TARGET_44 — квадрат 44×44 по центру иконки (для круглых кнопок).
 * TAP_TARGET_ROW_44 — полоса во всю ширину контрола и 44px в высоту: для
 * широких, но низких элементов (вкладки, чипы), где квадрат перекрыл бы соседа.
 */
export const TAP_TARGET_44 =
  "relative after:absolute after:left-1/2 after:top-1/2 after:h-11 after:w-11 after:-translate-x-1/2 after:-translate-y-1/2 after:content-['']";

export const TAP_TARGET_ROW_44 =
  "relative after:absolute after:inset-x-0 after:top-1/2 after:h-11 after:-translate-y-1/2 after:content-['']";
