import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  communityName: string;
}

/**
 * Предложка сообщества: пока её нет, она так и говорит.
 *
 * Здесь была форма с заголовком и текстом, кнопкой «Отправить на
 * рассмотрение» и — после `setTimeout` на 600 мс — сообщением «Пост
 * отправлен на рассмотрение». Запроса не было ни одного: серверного
 * маршрута предложки не существует, и поиск по `backend/app`,
 * `backend/routes` и схеме базы тремя разными способами не нашёл ни
 * маршрута, ни колонки.
 *
 * То есть человек писал текст, нажимал кнопку, получал подтверждение и
 * ждал решения администратора — которому ничего не приходило.
 * `docs/BIBLE.md` 4.3 знает об этом: «Предложка — не работает, форма
 * показывает „отправлено“, ничего не отправляя».
 *
 * Насколько это было опасно на самом деле. Точка входа закрыта условием
 * `community.allowSubmitPost`, а этого поля бэкенд не отдаёт: его нет ни
 * в ресурсе сообщества, ни в схеме, ни в ответе прода — только в
 * `lib/mock.ts`. Значит на боевых данных пункт меню не показывался
 * вовсе, и до ложного подтверждения живой человек дойти не мог. Форма
 * врала только в демо-режиме, который на localhost включается сам.
 *
 * Поэтому правка не спешная, но и откладывать её незачем: стоит добавить
 * поле на сервере — и ложь начнёт работать на живых людях. Дешевле убрать
 * её сейчас, пока это удаление, а не разбор.
 *
 * Что здесь нарочно НЕ сделано: серверная часть предложки. Это отдельная
 * работа (очередь модерации, права администратора сообщества,
 * уведомления), и `docs/BIBLE.md` VII.5 относит её к тому, что можно
 * делать при живых людях.
 */
export function SubmitPostSheet({ open, onOpenChange, communityName }: Props) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="rounded-t-2xl p-0 sm:max-w-lg sm:left-1/2 sm:-translate-x-1/2"
      >
        <SheetHeader className="px-5 pt-5">
          <SheetTitle>Предложить пост</SheetTitle>
          <SheetDescription>
            Предложка в сообществе «{communityName}» ещё не работает — отправить пост через неё
            нельзя.
          </SheetDescription>
        </SheetHeader>
        <div className="space-y-3 p-5">
          <p className="text-[14px] leading-[1.5]" style={{ color: "var(--foreground-70)" }}>
            Пока предложка не готова, напишите администратору сообщества в мессенджере — так
            предложение точно дойдёт.
          </p>
          <div className="flex justify-end pt-2">
            <button
              onClick={() => onOpenChange(false)}
              className="font-semibold"
              style={{
                height: 40,
                padding: "0 20px",
                borderRadius: 10,
                background: "var(--accent-fill)",
                color: "white",
                fontSize: 14,
              }}
            >
              Понятно
            </button>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
