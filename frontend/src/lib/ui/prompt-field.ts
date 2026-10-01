import { toast } from "@/lib/toast";
import { askText } from "@/lib/ui/ask";

/**
 * Правка существующего значения через цепочку окон.
 *
 * Отказ в окне означает «это поле я не меняю», а не «забудь всё, что я
 * ввёл до сих пор». Разница видна только в правке: при создании отменять
 * нечего, и там `askText` разбирается на месте.
 *
 * До 01.10 правка направления в админке была цепочкой из пяти окон, и
 * первые два — имя и slug — обрывали её молча:
 *
 *     const name = (await askText({ … }))?.trim();
 *     if (!name) return;
 *
 * `?.trim()` даёт `undefined` на отказе и `""` на стёртом поле, а `!name`
 * не отличает одно от другого. Человек менял название, на вопросе про
 * slug нажимал «Отмена» — и правка исчезала без единого слова. Снаружи
 * это и есть «правлю, сохраняю — не применяется»: сервер при этом не
 * терял ничего, запроса к нему просто не было.
 *
 * Иконка, порядок и родитель в той же цепочке отказ переносили верно —
 * то есть два поля из пяти вели себя иначе, чем остальные три.
 */
export type PromptField = { kind: "value"; value: string } | { kind: "empty" };

/**
 * Что человек ответил: значение или пустота.
 *
 * @param answer   Ответ окна: `null` — отказ, строка — введённое.
 * @param current  Значение до правки; его и возвращаем при отказе.
 */
export function readPromptField(answer: string | null, current: string): PromptField {
  if (answer === null) return { kind: "value", value: current };

  const value = answer.trim();

  return value === "" ? { kind: "empty" } : { kind: "value", value };
}

/**
 * Спросить значение обязательного поля при правке.
 *
 * @returns Значение — новое либо прежнее. `null` означает «дальше не
 *          идём»: человек стёр обязательное поле, и ему об этом сказано.
 */
export async function askRequiredField(opts: {
  title: string;
  current: string;
  emptyMessage: string;
}): Promise<string | null> {
  const разбор = readPromptField(
    await askText({ title: opts.title, defaultValue: opts.current }),
    opts.current,
  );

  if (разбор.kind === "empty") {
    toast.error(opts.emptyMessage);

    return null;
  }

  return разбор.value;
}
