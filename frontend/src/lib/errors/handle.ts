/**
 * Три ответа на неудавшийся запрос — и ни одного четвёртого.
 *
 * До 11.09 в маршрутах и компонентах было 76 мест вида
 * `.catch(() => {})`. Отказ исчезал бесследно: запрос падал, состояние
 * оставалось прежним, пользователь смотрел на пустой список или на
 * «сохранено», которого не случилось. Так «загрузка обзоров не удалась»
 * выглядела как «обзоров нет».
 *
 * Пустой `catch` запрещён правилом eslint (`no-restricted-syntax` в
 * eslint.config.js). Вместо него — один из трёх помощников ниже. Выбор
 * между ними определяется не удобством, а тем, что человек делал в этот
 * момент.
 *
 * `reportActionFailure` — человек нажал кнопку и ждёт ответа. Оплата,
 * вывод, публикация, отправка, удаление. Молчать нельзя: он уверен, что
 * действие прошло.
 *
 * `reportReadFailure` — страница загружала данные, и пользователь ничего
 * не нажимал. Тост тут неуместен — нужно состояние в интерфейсе с
 * «Повторить». Помощник только записывает отказ; за отрисовку отвечает
 * место вызова, и в этом смысле он не решение, а половина решения.
 *
 * `ignoreFailure` — фон, за которым никто не следит: отметка о прочтении,
 * счётчик просмотра, ICE-кандидат, автовоспроизведение. Молчать здесь
 * правильно, теряться — нет. Причина указывается словами и остаётся в
 * коде: «молчим, потому что…» проверяемо, `.catch(() => {})` — нет.
 */
import { reportLovableError } from "@/lib/lovable-error-reporting";
import { toast } from "@/lib/toast";

type Context = Record<string, unknown>;

/** Сообщение из ошибки, если оно годится для показа человеку. */
function messageOf(error: unknown): string | undefined {
  if (error instanceof Error && error.message) {
    // Технические строки вроде "Failed to fetch" человеку ничего не говорят
    // и только пугают: показываем лишь то, что пришло от нашего API.
    return /^[A-Za-z ]+$/.test(error.message) ? undefined : error.message;
  }

  return undefined;
}

/**
 * Действие пользователя не прошло — сказать об этом.
 *
 * @param title Что именно не удалось, глазами человека: «Не удалось
 *              опубликовать объявление».
 */
export function reportActionFailure(error: unknown, title: string, context: Context = {}): void {
  const description = messageOf(error);

  toast.error(title, description ? { description } : undefined);
  reportLovableError(error, { kind: "action", title, ...context });
}

/**
 * Загрузка данных не удалась. Показывать состояние — задача вызывающего.
 */
export function reportReadFailure(error: unknown, what: string, context: Context = {}): void {
  reportLovableError(error, { kind: "read", what, ...context });
}

/**
 * Отказ, о котором пользователю знать незачем.
 *
 * @param reason Почему молчание здесь правильно. Пишется словами и
 *               остаётся в коде — это единственное, что отличает
 *               осознанное молчание от забытого обработчика.
 */
export function ignoreFailure(reason: string, context: Context = {}): (error: unknown) => void {
  return (error: unknown) => {
    reportLovableError(error, { kind: "background", reason, ...context });
  };
}
