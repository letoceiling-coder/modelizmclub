/**
 * Подтверждение и ввод строки — диалогами проекта вместо window.confirm
 * и window.prompt.
 *
 * Нативные окна подавляются во встроенных браузерах (Telegram, VK, почтовые
 * клиенты) и в webview приложений: `confirm()` там возвращает false, а
 * `prompt()` бросает «prompt() is not supported». Кнопка при этом молча не
 * делает ничего — ни ошибки, ни объяснения. Поймано 08.09 на проде: в
 * админке так не создавалась категория, в карточке сделки не работали
 * «Подтвердить получение» и «Запросить возврат».
 *
 * Хост монтируется один раз в корне. Если его почему-то нет (SSR, тест,
 * ранний кадр) — падаем обратно на нативное окно, чтобы поведение не стало
 * хуже прежнего.
 */

export type ConfirmRequest = {
  kind: "confirm";
  title: string;
  description?: string;
  confirmLabel?: string;
  cancelLabel?: string;
  danger?: boolean;
};

export type PromptRequest = {
  kind: "prompt";
  title: string;
  description?: string;
  defaultValue?: string;
  placeholder?: string;
  confirmLabel?: string;
  cancelLabel?: string;
};

export type PendingRequest = (ConfirmRequest | PromptRequest) & {
  resolve: (value: string | boolean | null) => void;
};

let enqueue: ((req: PendingRequest) => void) | null = null;

/** Хост зовёт это при монтировании; возвращает функцию отписки. */
export function registerAskHost(fn: (req: PendingRequest) => void): () => void {
  enqueue = fn;

  return () => {
    if (enqueue === fn) enqueue = null;
  };
}

export function askConfirm(request: Omit<ConfirmRequest, "kind">): Promise<boolean> {
  if (!enqueue) {
    if (typeof window === "undefined") return Promise.resolve(false);

    return Promise.resolve(
      window.confirm([request.title, request.description].filter(Boolean).join("\n\n")),
    );
  }

  return new Promise<boolean>((resolve) => {
    enqueue!({ ...request, kind: "confirm", resolve: (value) => resolve(value === true) });
  });
}

export function askText(request: Omit<PromptRequest, "kind">): Promise<string | null> {
  if (!enqueue) {
    if (typeof window === "undefined") return Promise.resolve(null);

    return Promise.resolve(window.prompt(request.title, request.defaultValue ?? ""));
  }

  return new Promise<string | null>((resolve) => {
    enqueue!({
      ...request,
      kind: "prompt",
      resolve: (value) => resolve(typeof value === "string" ? value : null),
    });
  });
}
