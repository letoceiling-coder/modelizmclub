/**
 * Отправка черновика комментария с возвратом набранного при отказе.
 *
 * Поле очищается сразу — человек видит, что комментарий ушёл. Если сервер
 * отказал (`send` вернул `false`), набранное возвращается, как в сообщениях
 * (`routes/messenger.tsx`, send). Новый текст, начатый за время отправки,
 * не затирается: возвращаем только в пустое поле.
 *
 * `void` от `send` — страница об исходе не сообщает, считаем отправленным.
 */
export async function sendCommentDraft(
  text: string,
  setDraft: (update: (current: string) => string) => void,
  send: () => void | Promise<boolean>,
): Promise<boolean> {
  setDraft(() => "");
  const accepted = await send();
  if (accepted === false) {
    setDraft((current) => current || text);
    return false;
  }
  return true;
}
