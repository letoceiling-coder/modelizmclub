import type { CdekPickupPoint } from "@/lib/api/cdek";

/**
 * Пункты выдачи для карты: точки с координатами и рамка, в которую они все
 * помещаются.
 *
 * Отдельно от самой карты, потому что здесь легко ошибиться молча. Пункт без
 * координат на карте не нарисуешь, а список из четырёхсот точек, среди
 * которых одна с нулевыми координатами, растягивает рамку на пол-Атлантики —
 * и карта открывается океаном вместо города.
 */

export interface PvzFeature {
  type: "Feature";
  id: string;
  geometry: { type: "Point"; coordinates: [number, number] };
  properties: { balloonContentHeader: string; balloonContentBody: string; hintContent: string };
}

/**
 * Координаты есть и они настоящие.
 *
 * Ноль — не координата, а пропуск: СДЭК отдаёт нули у пунктов, которым
 * координаты не проставили. Точка (0, 0) лежит в Атлантике, и одна такая
 * растягивает рамку на полмира.
 */
function сКоординатами(p: CdekPickupPoint): p is CdekPickupPoint & {
  latitude: number;
  longitude: number;
} {
  return (
    typeof p.latitude === "number" &&
    typeof p.longitude === "number" &&
    Number.isFinite(p.latitude) &&
    Number.isFinite(p.longitude) &&
    p.latitude !== 0 &&
    p.longitude !== 0
  );
}

export function pvzFeatures(points: CdekPickupPoint[]): PvzFeature[] {
  return points.filter(сКоординатами).map((p) => ({
    type: "Feature",
    id: p.id,
    geometry: { type: "Point", coordinates: [p.latitude, p.longitude] },
    properties: {
      balloonContentHeader: p.name,
      balloonContentBody: p.address ?? "",
      hintContent: p.address ?? p.name,
    },
  }));
}

/**
 * Рамка, в которую помещаются все точки: [[юг, запад], [север, восток]].
 *
 * `null`, когда показывать нечего — ни одной точки с координатами. Карта в
 * этом случае не открывается вовсе: пустая карта города вместо списка
 * ничего не сообщает, а место занимает.
 */
export function pvzBounds(points: CdekPickupPoint[]): [[number, number], [number, number]] | null {
  const точки = points.filter(сКоординатами);
  if (точки.length === 0) return null;

  const lat = точки.map((p) => p.latitude);
  const lon = точки.map((p) => p.longitude);

  return [
    [Math.min(...lat), Math.min(...lon)],
    [Math.max(...lat), Math.max(...lon)],
  ];
}
