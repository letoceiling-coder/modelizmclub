import { isCdekDelivery, isPickupDelivery } from "@/lib/config/deliveryMethods";

/**
 * Посылка в форме объявления: что поедет в расчёт тарифа СДЭК.
 *
 * До 22.09 габариты можно было не указывать — вместо них выбирался
 * типоразмер S/M/L, за которым стояла придуманная коробка. Тариф считался по
 * ней, в пункт приёма приезжала настоящая, и разницу доплачивала площадка.
 *
 * Вынесено из маршрута отдельным модулем не ради порядка: развилка «чего не
 * хватает» проверяется здесь без поднятия формы, а на экране ошибка в ней
 * выглядит как исправная кнопка, которая просто ничего не делает.
 */

/** Поля формы, от которых зависит посылка. */
export interface ParcelForm {
  deliveries: string[];
  weightKg: string;
  dimL: string;
  dimW: string;
  dimH: string;
  pickupAddress: string;
}

export interface ParcelInput {
  weightKg?: number;
  dimensionsCm?: { length: number; width: number; height: number };
  pickupAddress?: string;
}

/** Вес пишут и через запятую — это не ошибка ввода, а привычка. */
const число = (v: string): number => Number(String(v).replace(",", "."));

interface Измерения {
  length: number;
  width: number;
  height: number;
  weight: number;
}

function измерения(form: ParcelForm): Измерения {
  return {
    length: Number(form.dimL),
    width: Number(form.dimW),
    height: Number(form.dimH),
    weight: число(form.weightKg),
  };
}

/** Одна строка о том, по каким данным посчитается доставка. */
export function parcelSummary(form: ParcelForm): string {
  const { length, width, height, weight } = измерения(form);

  if (length > 0 && width > 0 && height > 0 && weight > 0) {
    return `Тариф посчитаем по вашим размерам: ${length}×${width}×${height} см, ${weight} кг.`;
  }

  return "Укажите все четыре значения — иначе тариф не посчитать.";
}

/** Пределы совпадают с серверными (`ListingFormRules`). */
const СМ_МАКС = 200;
const КГ_МАКС = 100;

export type ParcelField = "dimL" | "dimW" | "dimH" | "weightKg";

/**
 * Что не так с каждым полем посылки. Пустой объект — всё в порядке.
 *
 * Поимённо, а не одной строкой на четыре поля: на форме, где заполнено три из
 * четырёх, «укажите габариты» не говорит человеку, какое поле осталось, — он
 * видит выключенную кнопку и не понимает, что от него хотят.
 *
 * Верхние пределы здесь те же, что на сервере. Без них 250 см проходили
 * проверку формы и возвращались отказом сервера, привязанным к ключу
 * `dimensions_cm.length`, — а форма про такой ключ ничего не знает.
 */
export function parcelFieldErrors(form: ParcelForm): Partial<Record<ParcelField, string>> {
  if (!form.deliveries.some(isCdekDelivery)) return {};

  const значения: Array<[ParcelField, number, string, number, string]> = [
    ["dimL", Number(form.dimL), "длину", СМ_МАКС, "см"],
    ["dimW", Number(form.dimW), "ширину", СМ_МАКС, "см"],
    ["dimH", Number(form.dimH), "высоту", СМ_МАКС, "см"],
    ["weightKg", число(form.weightKg), "вес", КГ_МАКС, "кг"],
  ];

  const ошибки: Partial<Record<ParcelField, string>> = {};
  for (const [поле, значение, что, максимум, единица] of значения) {
    if (!(значение > 0)) ошибки[поле] = `Укажите ${что} посылки`;
    else if (значение > максимум) ошибки[поле] = `Не больше ${максимум} ${единица}`;
  }

  return ошибки;
}

/**
 * Одной строкой — для тоста при отправке. `null` — всё на месте.
 *
 * Тот же порядок, что у отказа сервера в
 * `ListingService::assertDeliveryDetails`.
 */
export function parcelMissing(form: ParcelForm): string | null {
  const ошибки = parcelFieldErrors(form);
  const поля = Object.keys(ошибки) as ParcelField[];
  if (поля.length > 0) {
    const имена: Record<ParcelField, string> = {
      dimL: "длину",
      dimW: "ширину",
      dimH: "высоту",
      weightKg: "вес",
    };
    const плохие = поля.filter((п) => ошибки[п]?.startsWith("Укажите"));
    if (плохие.length > 0) {
      return `Для СДЭК укажите ${плохие.map((п) => имена[п]).join(", ")} посылки.`;
    }

    return `Проверьте габариты посылки: ${поля.map((п) => ошибки[п]).join("; ")}.`;
  }

  if (form.deliveries.some(isPickupDelivery) && form.pickupAddress.trim().length < 3) {
    return "Укажите адрес или ориентир для самовывоза.";
  }

  return null;
}

/**
 * Что уходит на сервер.
 *
 * Габариты кладутся только вместе с доставкой СДЭК: без неё они серверу не
 * нужны, а оставить их в запросе значило бы записать в объявление размеры,
 * которых продавец больше не видит на форме.
 */
export function parcelFromForm(form: ParcelForm): ParcelInput {
  const cdek = form.deliveries.some(isCdekDelivery);
  const pickup = form.deliveries.some(isPickupDelivery);
  const { length, width, height, weight } = измерения(form);
  const полные = length > 0 && width > 0 && height > 0 && weight > 0;

  return {
    weightKg: cdek && полные ? weight : undefined,
    dimensionsCm: cdek && полные ? { length, width, height } : undefined,
    pickupAddress: pickup ? form.pickupAddress.trim() : undefined,
  };
}
