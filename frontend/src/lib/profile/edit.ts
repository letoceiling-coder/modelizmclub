/**
 * Правила окна «Редактировать профиль», вынесенные из ProfileView, чтобы их
 * можно было проверить без браузера.
 */

/** Разбор строки интересов «А, Б» — в таком виде они живут в User.interests. */
export function splitInterests(value: string | undefined): string[] {
  return (value || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/**
 * Выбор направления в списке сразу добавляет его в профиль.
 *
 * Было два шага: выбрать в списке и нажать «+». Выбранное, но не добавленное
 * направление в запрос не попадало, а «Сохранить» молча сохраняло остальное.
 * На проде 17.09: «Авиация» добавлена «+», «Корабли» выбраны в списке —
 * PUT /users/me/interests ушёл с category_ids [1], тост «Профиль обновлён».
 * Отсюда жалоба «выбрали два — сохранилось одно».
 */
export function addInterest(
  list: string[],
  name: string,
  max: number,
): { list: string[]; error?: "limit" } {
  const trimmed = name.trim();
  if (!trimmed || list.includes(trimmed)) return { list };
  if (list.length >= max) return { list, error: "limit" };
  return { list: [...list, trimmed] };
}

/**
 * Какой city_id отправить при сохранении профиля.
 *
 * Город существует только как строка справочника, выбранная из подсказок.
 * Раньше сохранение брало `cityId ?? draft.cityId`, и две вещи ломались:
 * стёртый город не стирался (пустое поле отправляло прежний id), а
 * набранный, но не выбранный текст уходил как `city_id: null` с тостом
 * «Профиль обновлён» — человек видел своё «Моск» в поле и не видел, что
 * город не сохранён.
 */
export function resolveProfileCityId(input: {
  /** Текст в поле города. */
  text: string | undefined;
  /** id, выбранный в подсказках (или сохранённый, если поле не трогали). */
  pickedId: number | undefined;
  savedId: number | undefined;
  savedName: string | undefined;
}): { cityId: number | null } | { error: "pick-from-list" } {
  const text = (input.text ?? "").trim();
  if (!text) return { cityId: null };
  if (input.pickedId !== undefined) return { cityId: input.pickedId };
  if (input.savedId !== undefined && text === (input.savedName ?? "").trim()) {
    return { cityId: input.savedId };
  }
  return { error: "pick-from-list" };
}
